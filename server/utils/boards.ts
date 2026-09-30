import { and, asc, desc, eq, exists, sql } from 'drizzle-orm'
import { db, runAtomic } from '../db'
import { board, boardColumn, membership } from '../db/schema'
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
  columns: { id: string, name: string, isGekocht: boolean, dishes: DishView[] }[]
}

// The user's Boards, the one they opened last first.
export async function listBoards(userId: string): Promise<BoardSummary[]> {
  return db
    .select({ id: board.id, name: board.name, emoji: board.emoji, isOwner: membership.isOwner })
    .from(membership)
    .innerJoin(board, eq(board.id, membership.boardId))
    .where(eq(membership.userId, userId))
    .orderBy(sql`${membership.lastOpenedAt} desc nulls last`, desc(membership.joinedAt))
}

// The Board the app opens on: the one used last. A user who belongs to no
// Board at all (a first sign-in) gets "Meine Küche" created for them here --
// not when their account is created, so someone arriving through an Invite
// Link can join that Board first and never get an extra empty one (story 4).
export async function landingBoardId(userId: string): Promise<string> {
  const [last] = await listBoards(userId)
  if (last) return last.id

  const columns = sql.join(
    DEFAULT_COLUMNS.map((c, i) => sql`(${c.name}, ${i}::int, ${c.isGekocht}::boolean)`),
    sql`, `,
  )
  await runAtomic(d => [
    // Serialises concurrent first landings of the same user until commit, so
    // a second one sees the first one's Board and creates none.
    d.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`starter-board:${userId}`}, 0))`),
    d.execute(sql`
      with new_board as (
        insert into ${board} (name, emoji)
        select ${STARTER_BOARD.name}, ${STARTER_BOARD.emoji}
        where not exists (select 1 from ${membership} where user_id = ${userId})
        returning id
      ), owner as (
        insert into ${membership} (board_id, user_id, is_owner)
        select id, ${userId}, true from new_board
      )
      insert into ${boardColumn} (board_id, name, position, is_gekocht)
      select new_board.id, c.name, c.position, c.is_gekocht
      from new_board cross join (values ${columns}) as c(name, position, is_gekocht)
    `),
  ])

  const [created] = await listBoards(userId)
  if (!created) throw new Error(`no landing Board for user ${userId}`)
  return created.id
}

// The Board with its Columns and their Dishes, or null unless the user is one of its Members.
export async function getBoard(boardId: string, userId: string): Promise<BoardView | null> {
  const [found] = await db
    .select({ id: board.id, name: board.name, emoji: board.emoji, isOwner: membership.isOwner })
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

// The user's membership of the Board, if any.
export function membershipOf(boardId: string, userId: string) {
  return db
    .select({ boardId: membership.boardId })
    .from(membership)
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId)))
}

// Whether the user is a Member of the Board.
export async function isMember(boardId: string, userId: string): Promise<boolean> {
  const [found] = await membershipOf(boardId, userId)
  return found !== undefined
}
