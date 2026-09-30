import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, exists, inArray, sql, type SQL } from 'drizzle-orm'
import { db, runAtomic, type Db } from '../db'
import { board, boardColumn, dish, membership, user } from '../db/schema'
import type { ColumnView } from './columns'
import { dishesByColumn, type DishView } from './dishes'

// The Board a user gets on their first sign-in (PRD story 3).
const STARTER_BOARD = { name: 'Meine Küche', emoji: '🍳' }

// Every new Board starts with these Columns; the last is the Gekocht Column.
export const DEFAULT_COLUMNS = [
  { name: 'Ideen', isGekocht: false },
  { name: 'Diese Woche', isGekocht: false },
  { name: 'Gekocht', isGekocht: true },
] as const

// A Board as Board settings shows it: its name and emoji.
export interface BoardNameAndEmoji {
  id: string
  name: string
  emoji: string
}

// What Board settings may change.
export type BoardChanges = Partial<Pick<BoardNameAndEmoji, 'name' | 'emoji'>>

export interface BoardSummary extends BoardNameAndEmoji {
  isOwner: boolean
}

export interface BoardView extends BoardSummary {
  // The secret of its Invite Link, which every Member may share.
  inviteToken: string
  columns: { id: string, name: string, isGekocht: boolean, dishes: DishView[] }[]
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

// The user's Boards in a steady order, the one they joined first first, so
// the switcher doesn't reshuffle whenever they switch.
export async function listBoards(userId: string): Promise<BoardListing[]> {
  const boards = await db
    .select({
      id: board.id,
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
      .select({ boardId: membership.boardId, id: user.id, name: user.name, image: user.image })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(inArray(membership.boardId, ids))
      .orderBy(desc(membership.isOwner), asc(membership.joinedAt)),
    db
      .select({ boardId: boardColumn.boardId, id: boardColumn.id, name: boardColumn.name, isGekocht: boardColumn.isGekocht })
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
export async function landingBoardId(userId: string): Promise<string> {
  const [last] = await lastOpenedBoard(userId)
  if (last) return last.id

  await runAtomic(d => [
    // Serialises concurrent first landings of the same user until commit, so
    // a second one sees the first one's Board and creates none.
    d.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`starter-board:${userId}`}, 0))`),
    insertBoard(d, randomUUID(), userId, STARTER_BOARD, sql`not exists (select 1 from ${membership} where user_id = ${userId})`),
  ])

  const [created] = await lastOpenedBoard(userId)
  if (!created) throw new Error(`no landing Board for user ${userId}`)
  return created.id
}

// The Board the user opened last (or joined last, if they opened none yet).
function lastOpenedBoard(userId: string) {
  return db
    .select({ id: membership.boardId })
    .from(membership)
    .where(eq(membership.userId, userId))
    .orderBy(sql`${membership.lastOpenedAt} desc nulls last`, desc(membership.joinedAt))
    .limit(1)
}

// Creates a Board (PRD story 61) with the default Columns and the user as
// its Owner.
export async function createBoard(userId: string, { name, emoji }: Omit<BoardNameAndEmoji, 'id'>): Promise<BoardSummary> {
  const id = randomUUID()
  await runAtomic(d => [insertBoard(d, id, userId, { name, emoji })])
  return { id, name, emoji, isOwner: true }
}

// One statement inserting a Board, its Owner and its default Columns, only
// `where` that holds.
function insertBoard(d: Db, id: string, userId: string, { name, emoji }: Omit<BoardNameAndEmoji, 'id'>, where: SQL = sql`true`) {
  const columns = sql.join(
    DEFAULT_COLUMNS.map((c, i) => sql`(${c.name}, ${i}::int, ${c.isGekocht}::boolean)`),
    sql`, `,
  )
  return d.execute(sql`
    with new_board as (
      insert into ${board} (id, name, emoji)
      select ${id}, ${name}, ${emoji}
      where ${where}
      returning id
    ), owner as (
      insert into ${membership} (board_id, user_id, is_owner)
      select id, ${userId}, true from new_board
    )
    insert into ${boardColumn} (board_id, name, position, is_gekocht)
    select new_board.id, c.name, c.position, c.is_gekocht
    from new_board cross join (values ${columns}) as c(name, position, is_gekocht)
  `)
}

// The Board with its Columns and their Dishes, or null unless the user is one of its Members.
export async function getBoard(boardId: string, userId: string): Promise<BoardView | null> {
  const [found] = await db
    .select({ id: board.id, name: board.name, emoji: board.emoji, isOwner: membership.isOwner, inviteToken: board.inviteToken })
    .from(membership)
    .innerJoin(board, eq(board.id, membership.boardId))
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId)))
  if (!found) return null

  const columns = await db
    .select({ id: boardColumn.id, name: boardColumn.name, isGekocht: boardColumn.isGekocht })
    .from(boardColumn)
    .where(eq(boardColumn.boardId, boardId))
    .orderBy(asc(boardColumn.position))
  const dishes = await dishesByColumn(columns.map(c => c.id))
  return { ...found, columns: columns.map(c => ({ ...c, dishes: dishes.get(c.id) ?? [] })) }
}

// Records that the user just opened the Board. False unless they are a Member.
export async function markOpened(boardId: string, userId: string): Promise<boolean> {
  const updated = await db
    .update(membership)
    .set({ lastOpenedAt: new Date() })
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId)))
    .returning({ boardId: membership.boardId })
  return updated.length > 0
}

// Renames the Board or changes its emoji (PRD story 62); fields left out stay
// as they are. Null unless the user is a Member.
export async function editBoard(boardId: string, userId: string, changes: BoardChanges): Promise<BoardNameAndEmoji | null> {
  const [edited] = await db
    .update(board)
    // Setting the id to itself keeps an empty change a valid statement.
    .set({ id: sql`${board.id}`, ...changes })
    .where(and(eq(board.id, boardId), exists(membershipOf(boardId, userId))))
    .returning({ id: board.id, name: board.name, emoji: board.emoji })
  return edited ?? null
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
