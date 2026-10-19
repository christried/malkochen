import { and, desc, eq, exists, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import { db, runAtomic, type Db } from '../db'
import { archivedMembership, board, dish, membership } from '../db/schema'
import { membershipOf, type BoardNameAndEmoji, type BoardSummary } from './boards'
import { slugOf } from './addresses'
import { RESTORABLE_FOR } from './dishes'
import { boardEvent, withEvents } from './events'

// Archived Boards (CONTEXT.md: Archived Board). The Owner deleting a Board
// archives it: `board.deleted_at` is set and its memberships move, as they
// are, to archived_membership. Everything that finds a user's Boards goes
// by membership (the Board list, the landing, Addresses, every Board and
// Dish endpoint, the Email Digest, Push Notifications), so an Archived
// Board is left out of it all without asking; only its Invite Link, found
// by its secret, checks `deleted_at` itself (server/utils/invites.ts). Its
// Columns and Dishes stay as they are. The Owner restores it, memberships
// and all, or deletes it for good; the cleanup purges it after
// RESTORABLE_FOR (server/utils/cleanup.ts).

// An Archived Board as the Owner's Board Switcher lists it under "Archiv".
export interface ArchivedBoardView extends Pick<BoardNameAndEmoji, 'id' | 'name' | 'emoji'> {
  archivedAt: string
  // When the daily cleanup purges it for good, at the earliest.
  purgesAt: string
}

const isArchived = (boardId: string) => sql`${board.id} = ${boardId} and ${board.deletedAt} is not null`

// The user's archived membership of the Board if they were its Owner.
function archivedOwnerOf(d: Db, boardId: string, userId: string) {
  return d
    .select({ userId: archivedMembership.userId })
    .from(archivedMembership)
    .where(and(eq(archivedMembership.boardId, boardId), eq(archivedMembership.userId, userId), archivedMembership.isOwner))
}

// The user's membership of the Board if they are its Owner.
function ownerOf(d: Db, boardId: string, userId: string) {
  return d
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId), membership.isOwner))
}

// The columns both membership tables share, in one order.
const membershipColumns = sql.raw('board_id, user_id, is_owner, last_opened_at, seen_at, new_since, joined_at')

// "Board löschen" (PRD story 42): the Owner archives the Board for every
// Member. 'archived' once it is, 'forbidden' for a Member who isn't the
// Owner, null for a non-Member (an Archived Board has none).
export async function archiveBoard(boardId: string, userId: string): Promise<'archived' | 'forbidden' | null> {
  const [found] = await membershipOf(boardId, userId)
  if (!found) return null
  if (!found.isOwner) return 'forbidden'
  // Archiving locks the Board's row first, so a join through its Invite Link
  // (which reads the row `for share`) either lands before and is moved along
  // by the next two statements, or waits and then finds it archived.
  // Checked again as it archives, in case ownership was handed over meanwhile.
  await runAtomic(d => [
    withEvents(
      d,
      d.update(board)
        .set({ deletedAt: sql`now()` })
        .where(and(eq(board.id, boardId), isNull(board.deletedAt), exists(ownerOf(d, boardId, userId))))
        .returning({ id: board.id }),
      { ...boardEvent('board_archived', userId), board: sql`changed.id` },
    ),
    d.execute(sql`
      insert into ${archivedMembership} (${membershipColumns})
      select ${membershipColumns} from ${membership}
      where ${membership.boardId} = ${boardId} and exists (select 1 from ${board} where ${isArchived(boardId)})
      on conflict do nothing
    `),
    d.delete(membership).where(and(eq(membership.boardId, boardId), exists(d.select({ id: board.id }).from(board).where(isArchived(boardId))))),
  ])
  const [archived] = await archivedOwnerOf(db, boardId, userId)
  return archived ? 'archived' : 'forbidden'
}

// The user's Archived Boards, the newest archived first: those they were
// the Owner of when they archived it.
export async function archivedBoards(userId: string): Promise<ArchivedBoardView[]> {
  const rows = await db
    .select({
      id: board.id,
      name: board.name,
      emoji: board.emoji,
      archivedAt: sql<Date>`${board.deletedAt}`.mapWith(board.deletedAt),
      purgesAt: sql<Date>`${board.deletedAt} + ${RESTORABLE_FOR}::interval`.mapWith(board.deletedAt),
    })
    .from(archivedMembership)
    .innerJoin(board, eq(board.id, archivedMembership.boardId))
    .where(and(eq(archivedMembership.userId, userId), archivedMembership.isOwner, isNotNull(board.deletedAt)))
    .orderBy(desc(board.deletedAt), desc(board.id))
  return rows.map(row => ({ ...row, archivedAt: row.archivedAt.toISOString(), purgesAt: row.purgesAt.toISOString() }))
}

// "Wiederherstellen" (story 44): the Owner brings the Board back, with its
// Members, as it was. The Board as the Board list shows it, or null unless
// it is an Archived Board of theirs.
export async function restoreBoard(boardId: string, userId: string): Promise<BoardSummary | null> {
  const [archived] = await archivedOwnerOf(db, boardId, userId)
  if (!archived) return null
  const live = exists(db.select({ id: board.id }).from(board).where(and(eq(board.id, boardId), isNull(board.deletedAt))))
  await runAtomic(d => [
    withEvents(
      d,
      d.update(board)
        .set({ deletedAt: null })
        .where(and(isArchived(boardId), exists(archivedOwnerOf(d, boardId, userId))))
        .returning({ id: board.id }),
      { ...boardEvent('board_restored', userId), board: sql`changed.id` },
    ),
    d.execute(sql`
      insert into ${membership} (${membershipColumns})
      select ${membershipColumns} from ${archivedMembership}
      where ${archivedMembership.boardId} = ${boardId} and ${live}
      on conflict do nothing
    `),
    d.delete(archivedMembership).where(and(eq(archivedMembership.boardId, boardId), live)),
  ])
  const [restored] = await db
    .select({ id: board.id, slug: slugOf, name: board.name, emoji: board.emoji, isOwner: membership.isOwner })
    .from(membership)
    .innerJoin(board, eq(board.id, membership.boardId))
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId), membership.isOwner))
  return restored ?? null
}

// "Endgültig löschen" (story 45): the Owner deletes an Archived Board for
// good, with its Columns, Dishes and Cookings. Answers the images its
// Dishes had, for the caller to remove; null unless it is an Archived
// Board of theirs.
export async function purgeBoard(boardId: string, userId: string): Promise<{ imageUrls: string[] } | null> {
  const images = await db
    .select({ url: dish.imageUrl })
    .from(dish)
    .where(and(eq(dish.boardId, boardId), isNotNull(dish.imageUrl), exists(archivedOwnerOf(db, boardId, userId))))
  const { rows } = await withEvents(
    db,
    db.delete(board).where(and(isArchived(boardId), exists(archivedOwnerOf(db, boardId, userId)))).returning({ id: board.id }),
    { ...boardEvent('board_deleted', userId), board: sql`changed.id` },
  )
  if (rows.length === 0) return null
  return { imageUrls: images.map(i => i.url).filter(url => url !== null) }
}

// The cleanup's part: deletes the Boards archived longer than
// RESTORABLE_FOR, with everything on them. How many it deleted.
export async function purgeExpiredBoards(): Promise<number> {
  const purged = await db
    .delete(board)
    .where(lt(board.deletedAt, sql`now() - ${RESTORABLE_FOR}::interval`))
    .returning({ id: board.id })
  return purged.length
}
