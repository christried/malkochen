import { and, eq, exists, not, sql, type SQL } from 'drizzle-orm'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { db, runAtomic } from '../db'
import { membership } from '../db/schema'
import { membershipOf, ownerOf } from './boards'
import { boardEvent, detailsOf, recordEvents, withEvents, type EventValues } from './events'

// Members and the Owner (CONTEXT.md): any Member but the Owner can leave; the
// Owner removes Members, hands ownership over and deletes the Board
// (server/utils/archived-boards.ts). A Board always has exactly one Owner,
// so the Owner hands over before leaving. The Dishes someone added stay
// when they go: a Dish records its adder as a user, not as a Member.

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
    return await deleteMembership(boardId, memberId, boardEvent('member_left', userId)) ? 'removed' : 'not-member'
  }
  if (!found.isOwner) return 'forbidden'
  // Checked again as it deletes, in case ownership was handed over meanwhile.
  return await deleteMembership(boardId, memberId, boardEvent('member_removed', userId, detailsOf({ member: memberId })), exists(ownerOf(boardId, userId))) ? 'removed' : 'not-member'
}

// Why ownership couldn't be handed over: the user isn't the Owner
// ('forbidden'), the Member is the Owner already ('self'), or nobody by that
// id is on the Board ('not-member').
export type HandOverRefusal = 'forbidden' | 'self' | 'not-member'

// The Owner makes another Member the Owner and stays on as a Member (PRD
// story 68). The new Owner has every Permission as Owner; the former one
// keeps every one too, until the new Owner changes them (#343).
// 'handed-over' once done, null for a non-Member.
export async function handOver(boardId: string, userId: string, memberId: string): Promise<'handed-over' | HandOverRefusal | null> {
  const [found] = await membershipOf(boardId, userId)
  if (!found) return null
  if (!found.isOwner) return 'forbidden'
  if (memberId === userId) return 'self'

  // Three steps, in one transaction. First the Member's row is locked, so
  // they can't leave or be removed until it is done (a leave already under
  // way finishes first, and then there is no row). Then the Owner steps down,
  // only if still the Owner and the Member is still on the Board; then the
  // Member steps up, only if the Board has no Owner -- so of two hand-overs
  // at once, the second changes nothing. Stepping down before up, since the
  // one-Owner index is checked row by row. The Board never has none, or two.
  const ownerFree = sql`not exists (select 1 from ${membership} m where m.board_id = ${boardId} and m.is_owner)`
  await runAtomic(d => [
    d.update(membership)
      .set({ isOwner: false })
      .where(and(eq(membership.boardId, boardId), eq(membership.userId, memberId), not(membership.isOwner))),
    d.update(membership)
      .set({ isOwner: false, permissions: ALL_PERMISSIONS })
      .where(and(
        eq(membership.boardId, boardId),
        eq(membership.userId, userId),
        membership.isOwner,
        exists(d.select({ userId: membership.userId }).from(membership).where(and(eq(membership.boardId, boardId), eq(membership.userId, memberId)))),
      )),
    d.update(membership)
      .set({ isOwner: true })
      .where(and(eq(membership.boardId, boardId), eq(membership.userId, memberId), ownerFree)),
    // Recorded only if this hand-over made the Member the Owner, from the
    // one who was.
    recordEvents(d, {
      kind: 'ownership_handed_over',
      board: sql`${boardId}::uuid`,
      user: userId,
      details: detailsOf({ member: memberId }),
    }, sql`from (select 1) as changed
      where exists (select 1 from ${membership} as m where m.board_id = ${boardId} and m.user_id = ${memberId} and m.is_owner)
      and not exists (select 1 from ${membership} as m where m.board_id = ${boardId} and m.user_id = ${userId} and m.is_owner)`),
  ])
  const [owner] = await ownerOf(boardId, memberId)
  if (owner) return 'handed-over'
  // Nothing changed: someone else handed over first, or the Member is gone.
  const [stillOwner] = await ownerOf(boardId, userId)
  return stillOwner ? 'not-member' : 'forbidden'
}

// Deletes a membership that isn't the Owner's, only `where` that holds,
// and records it as `event` says. Whether there was one.
async function deleteMembership(boardId: string, memberId: string, event: EventValues, where?: SQL): Promise<boolean> {
  const { rows } = await withEvents(
    db,
    db.delete(membership)
      .where(and(eq(membership.boardId, boardId), eq(membership.userId, memberId), not(membership.isOwner), where))
      .returning({ boardId: membership.boardId }),
    event,
  )
  return rows.length > 0
}

