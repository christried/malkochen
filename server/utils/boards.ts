import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, exists, gt, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import { db, runAtomic, type Db } from '../db'
import { board, boardColumn, boardSlug, dish, membership, user } from '../db/schema'
import { freeSlug, lockSlugs, recordSlug, slugOf } from './addresses'
import { columnView, type ColumnView } from './columns'
import { dishesByColumn, type DishView } from './dishes'
import { pictureOf } from './people'

// The Board a user gets on their first sign-in (PRD story 3).
const STARTER_BOARD = { name: 'Meine Küche', emoji: '🍲' }

// Every new Board starts with these Columns; the last is the Gekocht Column,
// whose Column Subtitle is fixed (GEKOCHT_SUBTITLE).
export const DEFAULT_COLUMNS = [
  { name: 'Ideen', subtitle: 'Worauf hast du Lust?', isGekocht: false },
  { name: 'Diese Woche', subtitle: 'Das steht an.', isGekocht: false },
  { name: 'Gekocht', subtitle: null, isGekocht: true },
] as const

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
}

export interface BoardView extends BoardSummary {
  // The secret of its Invite Link, which every Member may share.
  inviteToken: string
  // Everyone on it, the Owner first, as Board settings lists them.
  members: BoardMemberView[]
  columns: (ColumnView & { dishes: DishView[] })[]
  // Its New Dishes for the user looking (PRD story 37), marked "Neu".
  newDishIds: string[]
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
// whether they are the user looking.
export interface BoardMemberView extends BoardMember {
  isOwner: boolean
  isYou: boolean
}

// The user's Boards in a steady order, the one they joined first first, so
// the switcher doesn't reshuffle whenever they switch.
export async function listBoards(userId: string): Promise<BoardListing[]> {
  const boards = await db
    .select({
      id: board.id,
      slug: slugOf,
      name: board.name,
      emoji: board.emoji,
      isOwner: membership.isOwner,
      dishCount: sql<number>`(select count(*) from ${dish} where ${dish.boardId} = ${board.id} and ${dish.deletedAt} is null)::int`,
    })
    .from(membership)
    .innerJoin(board, eq(board.id, membership.boardId))
    .where(eq(membership.userId, userId))
    .orderBy(asc(membership.joinedAt), asc(board.createdAt), asc(board.id))
  if (boards.length === 0) return []

  const ids = boards.map(b => b.id)
  const [members, columns] = await Promise.all([
    db
      .select({ boardId: membership.boardId, id: user.id, name: user.name, image: pictureOf })
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
  return boards.map(b => ({
    ...b,
    members: members.filter(m => m.boardId === b.id).map(({ boardId: _, ...m }) => m),
    columns: columns.filter(c => c.boardId === b.id).map(({ boardId: _, ...c }) => c),
  }))
}

// The Board the app opens on: the one used last. A user who belongs to no
// Board at all (a first sign-in) gets "Meine Küche" created for them here --
// not when their account is created, so someone arriving through an Invite
// Link can join that Board first and never get an extra empty one (story 4).
export async function landingBoard(userId: string): Promise<{ boardId: string, slug: string }> {
  const [last] = await lastOpenedBoard(userId)
  if (last) return last

  await runAtomic(d => [
    // Serialises concurrent first landings of the same user until commit, so
    // a second one sees the first one's Board and creates none.
    d.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`starter-board:${userId}`}, 0))`),
    lockSlugs(d),
    insertBoard(d, randomUUID(), userId, STARTER_BOARD, sql`not exists (select 1 from ${membership} where user_id = ${userId})`),
  ])

  const [created] = await lastOpenedBoard(userId)
  if (!created) throw new Error(`no landing Board for user ${userId}`)
  return created
}

// The Board the user opened last (or joined last, if they opened none yet).
function lastOpenedBoard(userId: string) {
  return db
    .select({ boardId: membership.boardId, slug: slugOf })
    .from(membership)
    .innerJoin(board, eq(board.id, membership.boardId))
    .where(eq(membership.userId, userId))
    .orderBy(sql`${membership.lastOpenedAt} desc nulls last`, desc(membership.joinedAt))
    .limit(1)
}

// Creates a Board (PRD story 61) with the default Columns and the user as
// its Owner.
export async function createBoard(userId: string, { name, emoji }: NewBoard): Promise<BoardSummary> {
  const id = randomUUID()
  await runAtomic(d => [lockSlugs(d), insertBoard(d, id, userId, { name, emoji })])
  const [created] = await db.select({ slug: slugOf }).from(board).where(eq(board.id, id))
  if (!created) throw new Error(`Board ${id} was not created`)
  return { id, slug: created.slug, name, emoji, isOwner: true }
}

// One statement inserting a Board with its slug (after lockSlugs), its
// Owner and its default Columns, only `where` that holds.
function insertBoard(d: Db, id: string, userId: string, { name, emoji }: NewBoard, where: SQL = sql`true`) {
  const columns = sql.join(
    DEFAULT_COLUMNS.map((c, i) => sql`(${c.name}, ${c.subtitle}::text, ${i}::int, ${c.isGekocht}::boolean)`),
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
    )
    insert into ${boardColumn} (board_id, name, subtitle, position, is_gekocht)
    select new_board.id, c.name, c.subtitle, c.position, c.is_gekocht
    from new_board cross join (values ${columns}) as c(name, subtitle, position, is_gekocht)
  `)
}

// The Board with its Columns and their Dishes, or null unless the user is one of its Members.
export async function getBoard(boardId: string, userId: string): Promise<BoardView | null> {
  const [found] = await db
    .select({ id: board.id, slug: slugOf, name: board.name, emoji: board.emoji, isOwner: membership.isOwner, inviteToken: board.inviteToken, newSince: membership.newSince })
    .from(membership)
    .innerJoin(board, eq(board.id, membership.boardId))
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId)))
  if (!found) return null
  const { newSince, ...view } = found

  const columns = await db
    .select(columnView)
    .from(boardColumn)
    .where(eq(boardColumn.boardId, boardId))
    .orderBy(asc(boardColumn.position))
  const [dishes, members, newDishIds] = await Promise.all([
    dishesByColumn(columns.map(c => c.id)),
    boardMembers(boardId),
    newSince ? newDishesSince(boardId, userId, newSince) : [],
  ])
  return {
    ...view,
    members: members.map(m => ({ ...m, isYou: m.id === userId })),
    columns: columns.map(c => ({ ...c, dishes: dishes.get(c.id) ?? [] })),
    newDishIds,
  }
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
  const updated = await db
    .update(membership)
    // The right-hand sides read the row as it was. Never opened before,
    // everything others added since joining is new.
    .set({ newSince: sql`coalesce(${membership.lastOpenedAt}, ${membership.joinedAt})`, lastOpenedAt: new Date() })
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId)))
    .returning({ boardId: membership.boardId })
  return updated.length > 0
}

// Records that the user still has the Board open and has seen it up to now,
// so what they saw while it was open isn't New next time. False unless they
// are a Member.
export async function markSeen(boardId: string, userId: string): Promise<boolean> {
  const updated = await db
    .update(membership)
    .set({ lastOpenedAt: new Date() })
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
    d
      .update(board)
      // Setting the id to itself keeps an empty change a valid statement.
      .set({ id: sql`${board.id}`, ...changes, ...(renamed ? { slug: freeSlug(boardId, changes.name!) } : {}) })
      .where(and(eq(board.id, boardId), exists(membershipOf(boardId, userId)))),
    ...(renamed ? [recordSlug(d, boardId)] : []),
  ])
  const [edited] = await db
    .select({ id: board.id, slug: slugOf, name: board.name, emoji: board.emoji })
    .from(board)
    .where(and(eq(board.id, boardId), exists(membershipOf(boardId, userId))))
  return edited ?? null
}

// The Board's Members, the Owner first, then in the order they joined.
export function boardMembers(boardId: string) {
  return db
    .select({ id: user.id, name: user.name, image: pictureOf, isOwner: membership.isOwner })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.boardId, boardId))
    .orderBy(desc(membership.isOwner), asc(membership.joinedAt))
}

// The user's membership of the Board, if any, and whether they are its Owner.
export function membershipOf(boardId: string, userId: string) {
  return db
    .select({ boardId: membership.boardId, isOwner: membership.isOwner })
    .from(membership)
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId)))
}

// Whether the user is a Member of the Board.
export async function isMember(boardId: string, userId: string): Promise<boolean> {
  const [found] = await membershipOf(boardId, userId)
  return found !== undefined
}
