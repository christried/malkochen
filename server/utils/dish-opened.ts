import { and, eq, exists, gt, isNull, ne, or, sql, type AnyColumn } from 'drizzle-orm'
import { db } from '../db'
import { comment, cooking, dish, dishOpened, vote } from '../db/schema'
import { accessOf } from './board-access'
import { isDishMember } from './dishes'

// What a Dish's card marks as new in its Dish History (#335; PRD #318
// stories 30–31): a Comment, Vote or Cooking another Member added since the
// Member last opened the Dish's detail, or, if they never did, since they
// joined its Board. Their own never mark it, nor anything deleted since,
// nor the Dish's adding (a New Dish wears "Neu" instead). Opening the Dish
// clears it.

// Records that the user just opened the Dish's detail. False unless it is
// on a Board they are a Member of and not archived.
export async function markDishOpened(dishId: string, userId: string): Promise<boolean> {
  if (!await isDishMember(dishId, userId)) return false
  const openedAt = new Date()
  await db.insert(dishOpened).values({ dishId, userId, openedAt })
    .onConflictDoUpdate({ target: [dishOpened.dishId, dishOpened.userId], set: { openedAt } })
  return true
}

// The ids of the Board's Dishes with something new in their Dish History
// for the user.
export async function newInHistoryDishIds(boardId: string, userId: string): Promise<string[]> {
  const access = accessOf(userId)
  const since = sql`coalesce(${dishOpened.openedAt}, ${access.joinedAt})`
  const byOthers = (column: AnyColumn) => sql`${column} is distinct from ${userId}`
  const rows = await db
    .select({ id: dish.id })
    .from(dish)
    .innerJoin(access, eq(access.boardId, dish.boardId))
    .leftJoin(dishOpened, and(eq(dishOpened.dishId, dish.id), eq(dishOpened.userId, userId)))
    .where(and(
      eq(dish.boardId, boardId),
      isNull(dish.deletedAt),
      or(
        exists(db.select({ id: comment.id }).from(comment).where(and(
          eq(comment.dishId, dish.id), isNull(comment.deletedAt), byOthers(comment.authorId), gt(comment.createdAt, since),
        ))),
        exists(db.select({ id: cooking.id }).from(cooking).where(and(
          eq(cooking.dishId, dish.id), isNull(cooking.deletedAt), byOthers(cooking.recordedBy), gt(cooking.cookedAt, since),
        ))),
        exists(db.select({ up: vote.up }).from(vote).where(and(
          eq(vote.dishId, dish.id), ne(vote.userId, userId), gt(vote.votedAt, since),
        ))),
      ),
    ))
  return rows.map(r => r.id)
}
