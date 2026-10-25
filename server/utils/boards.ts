import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, exists, gt, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import { stringsFor } from '../../app/strings'
import { BOARDS_PER_USER } from '../../shared/board'
import type { Language } from '../../shared/language'
import { ALL_PERMISSIONS, type Permission, type Permissions } from '../../shared/permissions'
import { db, runAtomic, type Db } from '../db'
import { board, boardColumn, boardSlug, dish, membership, user } from '../db/schema'
import { freeSlug, lockSlugs, recordSlug, slugOf } from './addresses'
import { columnView, type ColumnView } from './columns'
import { dishesByColumn, type DishView } from './dishes'
import { newInHistoryDishIds } from './dish-opened'
import { detailsOf, insertEvents, withEvents } from './events'
import { usernameOf, pictureOf } from './people'
import { accessOf, accessOn } from './board-access'
import { effectivePermissions, permits } from './permissions'

// The Board a user gets on their first sign-in (PRD story 3), named in
// their language.
const starterBoard = (language: Language) => ({ name: stringsFor(language).boardStart.starter, emoji: '🍲' })

// Every new Board starts with these Columns, in its creator's language
// (#328); the last is the Gekocht Column, whose Column Subtitle is fixed
// and not stored (the app shows it in each viewer's language).
function defaultColumns(language: Language) {
  const { ideas, thisWeek, gekocht } = stringsFor(language).boardStart
  return [
    { ...ideas, isGekocht: false },
    { ...thisWeek, isGekocht: false },
    { name: gekocht, subtitle: null, isGekocht: true },
  ]
}

// A Board as Board settings shows it: its name and emoji, and the slug of
// its Address (/b/<slug>, CONTEXT.md), which follows its name.
export interface BoardNameAndEmoji {
  id: string
  slug: string
  name: string
  emoji: string
}

// What Board settings may change.
export type BoardChanges = Partial<Pick<BoardNameAndEmoji, 'name' | 'emoji'>>

// What a new Board is made from.
type NewBoard = Pick<BoardNameAndEmoji, 'name' | 'emoji'>

export interface BoardSummary extends BoardNameAndEmoji {
  isOwner: boolean
  // What the user looking may do on it (server/utils/permissions.ts):
  // everything for its Owner. The app hides what isn't allowed.
  permissions: Permissions
}

export interface BoardView extends BoardSummary {
  // Its Board Version (ADR 0008) as of this answer: it was read before the
  // rest, so a change made meanwhile moves the version past it and the
  // next check loads the Board again.
  version: number
  // The secret of its Invite Link, which every Member with "share the
  // Invite Link" may share; null for the others, who never see it.
  inviteToken: string | null
  // Its Default Permissions, which a Member joining through the Invite
  // Link gets; only for the Owner, who sets them.
  defaultPermissions?: Permissions
  // Everyone on it, the Owner first, as Board settings lists them.
  members: BoardMemberView[]
  columns: (ColumnView & { dishes: DishView[] })[]
  // Its New Dishes for the user looking (PRD story 37), marked "Neu".
  newDishIds: string[]
  // Its Dishes with something new in their Dish History for the user
  // looking (#335), since they last opened them (dish-opened.ts).
  newInHistoryDishIds: string[]
}

// A Board as the Board switcher lists it: how many Dishes it holds, its
// Members, and its Columns (for "Verschieben nach…").
export interface BoardListing extends BoardSummary {
  dishCount: number
  members: BoardMember[]
  columns: ColumnView[]
}

export interface BoardMember {
  id: string
  name: string
  image: string | null
}

// A Member as Board settings lists them: whether they are the Owner, and
// whether they are the user looking. Their Permissions only for the Owner
// looking, who switches them, and for the user's own row, to see what they
// may do there.
export interface BoardMemberView extends BoardMember {
  isOwner: boolean
  isYou: boolean
  permissions?: Permissions
}

// The user's Boards in a steady order, the one they joined first first, so
// the switcher doesn't reshuffle whenever they switch. Members without a
// Username yet in the user's `language`.
export async function listBoards(userId: string, language: Language): Promise<BoardListing[]> {
  const access = accessOf(userId)
  const boards = await db
    .select({
      id: board.id,
      slug: slugOf,
      name: board.name,
      emoji: board.emoji,
      isOwner: access.isOwner,
      storedPermissions: access.permissions,
      dishCount: sql<number>`(select count(*) from ${dish} where ${dish.boardId} = ${board.id} and ${dish.deletedAt} is null)::int`,
    })
    .from(access)
    .innerJoin(board, eq(board.id, access.boardId))
    .orderBy(asc(access.joinedAt), asc(board.createdAt), asc(board.id))
  if (boards.length === 0) return []

  const ids = boards.map(b => b.id)
  const [members, columns] = await Promise.all([
    db
      .select({ boardId: membership.boardId, id: user.id, name: usernameOf(language), image: pictureOf })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(inArray(membership.boardId, ids))
      .orderBy(desc(membership.isOwner), asc(membership.joinedAt)),
    db
      .select({ boardId: boardColumn.boardId, ...columnView })
      .from(boardColumn)
      .where(inArray(boardColumn.boardId, ids))
      .orderBy(asc(boardColumn.position)),
  ])
  return boards.map(({ storedPermissions, ...b }) => ({
    ...b,
    permissions: effectivePermissions({ isOwner: b.isOwner, permissions: storedPermissions }),
    members: members.filter(m => m.boardId === b.id).map(({ boardId: _, ...m }) => m),
    columns: columns.filter(c => c.boardId === b.id).map(({ boardId: _, ...c }) => c),
  }))
}

// The Board the app opens on: the one used last. A user who belongs to no
// Board at all (a first sign-in) gets "Meine Küche" created for them here --
// not when their account is created, so someone arriving through an Invite
// Link can join that Board first and never get an extra empty one (story 4).
// Created in the user's `language`.
export async function landingBoard(userId: string, language: Language): Promise<{ boardId: string, slug: string }> {
  const [last] = await lastOpenedBoard(userId)
  if (last) return last

  await runAtomic(d => [
    // Serialises concurrent first landings of the same user until commit, so
    // a second one sees the first one's Board and creates none.
    d.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`starter-board:${userId}`}, 0))`),
    lockSlugs(d),
    insertBoard(d, randomUUID(), userId, starterBoard(language), language, { starter: true, where: sql`not exists (select 1 from ${membership} where user_id = ${userId})` }),
  ])

  const [created] = await lastOpenedBoard(userId)
  if (!created) throw new Error(`no landing Board for user ${userId}`)
  return created
}

// Where something shared to malkochen opens (pages/share.vue): the Board
// the user opened last of those they may add Dishes to, with Add Dish open
// (`canAdd`). If they may add to none, the usual landing, without it.
export async function landingToAdd(userId: string, language: Language): Promise<{ boardId: string, slug: string, canAdd: boolean }> {
  const [addable] = await lastOpenedBoard(userId, 'addDishes')
  if (addable) return { ...addable, canAdd: true }
  const landing = await landingBoard(userId, language)
  // A first landing has just created their own Board, theirs to add to.
  const [created] = await lastOpenedBoard(userId, 'addDishes')
  return created ? { ...created, canAdd: true } : { ...landing, canAdd: false }
}

// The Board the user opened last (or joined last, if they opened none yet),
// of those they may add Dishes to if `addable`.
function lastOpenedBoard(userId: string, addable?: Permission) {
  const access = accessOf(userId)
  return db
    .select({ boardId: access.boardId, slug: slugOf })
    .from(access)
    .innerJoin(board, eq(board.id, access.boardId))
    .where(addable ? permits(addable, access) : undefined)
    .orderBy(sql`${access.lastOpenedAt} desc nulls last`, desc(access.joinedAt))
    .limit(1)
}

// Creates a Board (PRD story 61) with the default Columns, in the user's
// `language`, and the user as its Owner. Null if they already have
// BOARDS_PER_USER Boards of their own (#347): counted under the slugs' lock,
// so Boards created at once can't all slip under it.
export async function createBoard(userId: string, { name, emoji }: NewBoard, language: Language): Promise<BoardSummary | null> {
  const id = randomUUID()
  const underLimit = sql`(select count(*) from ${membership} where user_id = ${userId} and is_owner) < ${BOARDS_PER_USER}`
  await runAtomic(d => [lockSlugs(d), insertBoard(d, id, userId, { name, emoji }, language, { where: underLimit })])
  const [created] = await db.select({ slug: slugOf }).from(board).where(eq(board.id, id))
  if (!created) return null
  return { id, slug: created.slug, name, emoji, isOwner: true, permissions: ALL_PERMISSIONS }
}

// One statement inserting a Board with its slug (after lockSlugs), its
// Owner and its default Columns in `language`, and recording it, only
// `where` that holds. `starter`: the Board a first landing creates.
function insertBoard(d: Db, id: string, userId: string, { name, emoji }: NewBoard, language: Language, { starter = false, where = sql`true` }: { starter?: boolean, where?: SQL } = {}) {
  const columns = sql.join(
    defaultColumns(language).map((c, i) => sql`(${c.name}, ${c.subtitle}::text, ${i}::int, ${c.isGekocht}::boolean)`),
    sql`, `,
  )
  return d.execute(sql`
    with new_board as (
      insert into ${board} (id, name, emoji, slug)
      select ${id}, ${name}, ${emoji}, ${freeSlug(id, name)}
      where ${where}
      returning id, slug
    ), address as (
      insert into ${boardSlug} (slug, board_id)
      select slug, id from new_board
    ), owner as (
      insert into ${membership} (board_id, user_id, is_owner)
      select id, ${userId}, true from new_board
    ), recorded as (
      ${insertEvents({
        kind: 'board_created',
        board: sql`new_board.id`,
        user: userId,
        details: starter ? detailsOf({ starter: true }) : undefined,
      }, sql`from new_board`)}
    )
    insert into ${boardColumn} (board_id, name, subtitle, position, is_gekocht)
    select new_board.id, c.name, c.subtitle, c.position, c.is_gekocht
    from new_board cross join (values ${columns}) as c(name, subtitle, position, is_gekocht)
  `)
}

// The Board with its Columns and their Dishes, or null unless the user is
// one of its Members. Members without a Username yet in the user's `language`.
export async function getBoard(boardId: string, userId: string, language: Language): Promise<BoardView | null> {
  const access = accessOf(userId)
  const [found] = await db
    .select({ id: board.id, slug: slugOf, name: board.name, emoji: board.emoji, isOwner: access.isOwner, permissions: access.permissions, version: board.version, inviteToken: board.inviteToken, defaultPermissions: board.defaultPermissions, newSince: access.newSince })
    .from(access)
    .innerJoin(board, eq(board.id, access.boardId))
    .where(eq(access.boardId, boardId))
  if (!found) return null
  const { newSince, defaultPermissions, ...view } = found
  const permissions = effectivePermissions(view)

  const columns = await db
    .select(columnView)
    .from(boardColumn)
    .where(eq(boardColumn.boardId, boardId))
    .orderBy(asc(boardColumn.position))
  const [dishes, members, newDishIds, newInHistory] = await Promise.all([
    dishesByColumn(columns.map(c => c.id)),
    boardMembers(boardId, language),
    newSince ? newDishesSince(boardId, userId, newSince) : [],
    newInHistoryDishIds(boardId, userId),
  ])
  return {
    ...view,
    inviteToken: permissions.shareInvite ? view.inviteToken : null,
    ...view.isOwner && { defaultPermissions },
    permissions,
    members: members.map(({ permissions: stored, ...m }) => {
      const isYou = m.id === userId
      return { ...m, isYou, ...(view.isOwner || isYou) && { permissions: effectivePermissions({ isOwner: m.isOwner, permissions: stored }) } }
    }),
    columns: columns.map(c => ({ ...c, dishes: dishes.get(c.id) ?? [] })),
    newDishIds,
    newInHistoryDishIds: newInHistory,
  }
}

// The Board's version (ADR 0008), or null unless the user is one of its
// Members. One read by the membership's and the Board's primary keys, and
// no write: it is what an open Board asks every few seconds.
export async function boardVersion(boardId: string, userId: string): Promise<number | null> {
  const access = accessOf(userId)
  const [found] = await db
    .select({ version: board.version })
    .from(access)
    .innerJoin(board, eq(board.id, access.boardId))
    .where(eq(access.boardId, boardId))
  return found?.version ?? null
}

// The ids of the Board's Dishes that Members other than the user added after `since`.
async function newDishesSince(boardId: string, userId: string, since: Date): Promise<string[]> {
  const rows = await db
    .select({ id: dish.id })
    .from(dish)
    .where(and(
      eq(dish.boardId, boardId),
      isNull(dish.deletedAt),
      gt(dish.createdAt, since),
      sql`${dish.addedBy} is distinct from ${userId}`,
    ))
  return rows.map(r => r.id)
}

// Records that the user just opened the Board, which moves on what counts
// as New Dishes for them. False unless they are a Member.
export async function markOpened(boardId: string, userId: string): Promise<boolean> {
  const now = new Date()
  const updated = await db
    .update(membership)
    // The right-hand sides read the row as it was. Never opened before,
    // everything others added since joining is new.
    .set({ newSince: sql`coalesce(${membership.seenAt}, ${membership.joinedAt})`, seenAt: now, lastOpenedAt: now })
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId)))
    .returning({ boardId: membership.boardId })
  return updated.length > 0
}

// Records that the user still has the Board open and has seen it up to now,
// so what they saw while it was open isn't New next time. It doesn't count
// as opening it: a poll still out when the user switched Boards mustn't make
// the app land on the Board they left (#227). False unless they are a Member.
export async function markSeen(boardId: string, userId: string): Promise<boolean> {
  const updated = await db
    .update(membership)
    .set({ seenAt: new Date() })
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId)))
    .returning({ boardId: membership.boardId })
  return updated.length > 0
}

// Renames the Board or changes its emoji (PRD story 62); fields left out stay
// as they are. A new name gives it a new Address; the old one forwards.
// Null unless the user is a Member.
export async function editBoard(boardId: string, userId: string, changes: BoardChanges): Promise<BoardNameAndEmoji | null> {
  const renamed = changes.name !== undefined
  await runAtomic(d => [
    ...(renamed ? [lockSlugs(d)] : []),
    withEvents(
      d,
      d
        .update(board)
        // Setting the id to itself keeps an empty change a valid statement.
        .set({ id: sql`${board.id}`, ...changes, ...(renamed ? { slug: freeSlug(boardId, changes.name!) } : {}) })
        .where(and(eq(board.id, boardId), exists(accessOn(boardId, userId))))
        .returning({ id: board.id, name: board.name, emoji: board.emoji }),
      [
        // Recorded only for what changed.
        { kind: 'board_renamed', board: sql`changed.id`, user: userId, when: sql`changed.name is distinct from earlier.name` },
        { kind: 'board_emoji_changed', board: sql`changed.id`, user: userId, when: sql`changed.emoji is distinct from earlier.emoji` },
      ],
      { earlier: sql`select ${board.id}, ${board.name}, ${board.emoji} from ${board} where ${board.id} = ${boardId}` },
    ),
    ...(renamed ? [recordSlug(d, boardId)] : []),
  ])
  const [edited] = await db
    .select({ id: board.id, slug: slugOf, name: board.name, emoji: board.emoji })
    .from(board)
    .where(and(eq(board.id, boardId), exists(accessOn(boardId, userId))))
  return edited ?? null
}

// The Board's Members, the Owner first, then in the order they joined; those
// without a Username yet in `language`. With their stored Permissions,
// which only Board settings may show (BoardMemberView).
export function boardMembers(boardId: string, language: Language) {
  return db
    .select({ id: user.id, name: usernameOf(language), image: pictureOf, isOwner: membership.isOwner, permissions: membership.permissions })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.boardId, boardId))
    .orderBy(desc(membership.isOwner), asc(membership.joinedAt))
}
