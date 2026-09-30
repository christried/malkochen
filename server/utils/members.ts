import { and, eq, exists, inArray, not, sql, type SQL } from 'drizzle-orm'
import { db, runAtomic } from '../db'
import { board, membership } from '../db/schema'
import { membershipOf } from './boards'

// Members and the Owner (CONTEXT.md): any Member but the Owner can leave; the
// Owner removes Members, hands ownership over and deletes the Board. A Board
// always has exactly one Owner, so the Owner hands over before leaving. The
// Dishes someone added stay when they go: a Dish records its adder as a
// user, not as a Member.

// Why a Member couldn't be taken off the Board: the Owner leaving
// ('owner'), a Member who isn't the Owner removing someone else
// ('forbidden'), or nobody by that id on it ('not-member').
export type MemberRefusal = 'owner' | 'forbidden' | 'not-member'

// Takes the Member off the Board: the user themselves leaving (PRD story 70),
// or the Owner removing someone (story 67). 'removed' once they are gone,
// null for a non-Member.
export async function removeMember(boardId: string, userId: string, memberId: string): Promise<'removed' | MemberRefusal | null> {
  const [found] = await membershipOf(boardId, userId)
  if (!found) return null
  if (memberId === userId) {
    if (found.isOwner) return 'owner'
    return await deleteMembership(boardId, memberId) ? 'removed' : 'not-member'
  }
  if (!found.isOwner) return 'forbidden'
  // Checked again as it deletes, in case ownership was handed over meanwhile.
  return await deleteMembership(boardId, memberId, exists(ownerOf(boardId, userId))) ? 'removed' : 'not-member'
}

// Why ownership couldn't be handed over: the user isn't the Owner
// ('forbidden'), the Member is the Owner already ('self'), or nobody by that
// id is on the Board ('not-member').
export type HandOverRefusal = 'forbidden' | 'self' | 'not-member'

// The Owner makes another Member the Owner and stays on as a Member (PRD
// story 68). 'handed-over' once done, null for a non-Member.
export async function handOver(boardId: string, userId: string, memberId: string): Promise<'handed-over' | HandOverRefusal | null> {
  const [found] = await membershipOf(boardId, userId)
  if (!found) return null
  if (!found.isOwner) return 'forbidden'
  if (memberId === userId) return 'self'

  // Two steps, since the one-Owner index is checked row by row: the Owner
  // steps down, then the Member steps up. The first only goes ahead while the
  // user is still the Owner and the Member still on the Board, and it locks
  // both rows so neither can change before the second; the second only while
  // the Board has no Owner. So the Board never ends up with none, or two.
  await runAtomic(d => [
    d.update(membership)
      .set({ isOwner: false })
      .where(and(
        eq(membership.boardId, boardId),
        inArray(membership.userId, [userId, memberId]),
        sql`(select count(*) from ${membership} m where m.board_id = ${boardId} and ((m.user_id = ${userId} and m.is_owner) or (m.user_id = ${memberId} and not m.is_owner))) = 2`,
      )),
    d.update(membership)
      .set({ isOwner: true })
      .where(and(
        eq(membership.boardId, boardId),
        eq(membership.userId, memberId),
        sql`not exists (select 1 from ${membership} m where m.board_id = ${boardId} and m.is_owner)`,
      )),
  ])
  const [owner] = await ownerOf(boardId, memberId)
  return owner ? 'handed-over' : 'not-member'
}

// The Owner deletes the Board, with its Columns, Dishes and Cookings, for
// every Member (PRD story 69; the app asks for its name first). 'deleted'
// once gone, 'forbidden' for a Member who isn't the Owner, null for a
// non-Member.
export async function deleteBoard(boardId: string, userId: string): Promise<'deleted' | 'forbidden' | null> {
  const [found] = await membershipOf(boardId, userId)
  if (!found) return null
  if (!found.isOwner) return 'forbidden'
  // Checked again as it deletes, in case ownership was handed over meanwhile.
  const deleted = await db
    .delete(board)
    .where(and(eq(board.id, boardId), exists(ownerOf(boardId, userId))))
    .returning({ id: board.id })
  return deleted.length > 0 ? 'deleted' : 'forbidden'
}

// Deletes a membership that isn't the Owner's, only `where` that holds.
// Whether there was one.
async function deleteMembership(boardId: string, memberId: string, where?: SQL): Promise<boolean> {
  const deleted = await db
    .delete(membership)
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, memberId), not(membership.isOwner), where))
    .returning({ userId: membership.userId })
  return deleted.length > 0
}

// The user's membership of the Board if they are its Owner.
function ownerOf(boardId: string, userId: string) {
  return db
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId), membership.isOwner))
}
