import { and, desc, eq, gt, inArray, isNotNull, isNull, notExists, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../db'
import { cooking, dish, membership, user } from '../db/schema'
import type { DishAdder } from './dishes'
import { cookingEvent, withEvents } from './events'
import { pictureOf } from './people'

// One occasion a Dish was cooked (CONTEXT.md: Cooking), as its Cooking
// History shows it.
export interface CookingView {
  id: string
  cookedAt: string
  // Who recorded it; null once their account is gone.
  recordedBy: DishAdder | null
}

function selectCookings() {
  return db
    .select({
      id: cooking.id,
      dishId: cooking.dishId,
      cookedAt: cooking.cookedAt,
      recorderId: user.id,
      // Recording one takes a Username (server/middleware/auth.ts).
      recorderName: user.username,
      recorderImage: pictureOf,
    })
    .from(cooking)
    .leftJoin(user, eq(user.id, cooking.recordedBy))
    .$dynamic()
}

type CookingRow = Awaited<ReturnType<typeof selectCookings>>[number]

function toView({ dishId: _, recorderId, recorderName, recorderImage, ...row }: CookingRow): CookingView {
  return {
    ...row,
    recordedBy: recorderId ? { id: recorderId, name: recorderName ?? '', image: recorderImage } : null,
    cookedAt: row.cookedAt.toISOString(),
  }
}

// The Cooking History of each of the given Dishes, newest first.
export async function cookingsByDish(dishIds: string[]): Promise<Map<string, CookingView[]>> {
  const byDish = new Map<string, CookingView[]>(dishIds.map(id => [id, []]))
  if (dishIds.length === 0) return byDish

  const rows = await selectCookings()
    .where(and(inArray(cooking.dishId, dishIds), isNull(cooking.deletedAt)))
    .orderBy(desc(cooking.cookedAt), desc(cooking.id))
  for (const row of rows) byDish.get(row.dishId)?.push(toView(row))
  return byDish
}

// The Cooking, if its Dish is on a Board the user is a Member of and not
// deleted. A deleted Cooking counts only `includingDeleted`.
function onMembersDish(cookingId: string, userId: string, { includingDeleted = false } = {}) {
  return and(
    eq(cooking.id, cookingId),
    includingDeleted ? undefined : isNull(cooking.deletedAt),
    inArray(cooking.dishId, db
      .select({ id: dish.id })
      .from(dish)
      .innerJoin(membership, and(eq(membership.boardId, dish.boardId), eq(membership.userId, userId)))
      .where(isNull(dish.deletedAt))),
  )
}

// The Dish a Cooking belongs to. Null unless the user may see it (above).
export async function cookingDishId(cookingId: string, userId: string): Promise<string | null> {
  const [found] = await db.select({ dishId: cooking.dishId }).from(cooking).where(onMembersDish(cookingId, userId))
  return found?.dishId ?? null
}

// How long after recording a Cooking "Rückgängig" in the Gekocht toast may
// still take it back. The toast offers it for seconds, but its write waits
// for the cook's own write to settle first (the client Board module queues
// each Dish's writes), which a slow connection can hold back for minutes.
const UNDO_COOKING_MINUTES = 10

// The Cooking, if "Rückgängig" may take it back (#197): the newest in its
// Dish's Cooking History, recorded by the user, within UNDO_COOKING_MINUTES.
// Anything older, or another Member's, only the soft delete may remove.
export function undoableCooking(cookingId: string, userId: string) {
  const newer = alias(cooking, 'newer')
  return and(
    eq(cooking.id, cookingId),
    isNull(cooking.deletedAt),
    eq(cooking.recordedBy, userId),
    gt(cooking.cookedAt, sql`now() - make_interval(mins => ${UNDO_COOKING_MINUTES})`),
    // Newest as the Cooking History orders it (cookingsByDish).
    notExists(db
      .select({ id: newer.id })
      .from(newer)
      .where(and(
        eq(newer.dishId, cooking.dishId),
        isNull(newer.deletedAt),
        sql`(${newer.cookedAt}, ${newer.id}) > (${cooking.cookedAt}, ${cooking.id})`,
      ))),
  )
}

// Whether "Rückgängig" may take the Cooking back (above).
export async function isUndoableCooking(cookingId: string, userId: string): Promise<boolean> {
  const [found] = await db.select({ id: cooking.id }).from(cooking).where(undoableCooking(cookingId, userId))
  return found !== undefined
}

// Deletes a Cooking from the Cooking History (PRD story 48): a soft delete,
// so it can be restored.
export async function deleteCooking(cookingId: string, userId: string): Promise<boolean> {
  const { rows } = await withEvents(
    db,
    db.update(cooking).set({ deletedAt: new Date() }).where(onMembersDish(cookingId, userId)).returning({ id: cooking.id, dishId: cooking.dishId }),
    cookingEvent('cooking_deleted', userId),
  )
  return rows.length > 0
}

// Undoes deleting a Cooking. Restoring one that isn't deleted changes nothing.
export async function restoreCooking(cookingId: string, userId: string): Promise<CookingView | null> {
  const target = onMembersDish(cookingId, userId, { includingDeleted: true })
  await withEvents(
    db,
    db.update(cooking).set({ deletedAt: null }).where(target).returning({ id: cooking.id, dishId: cooking.dishId }),
    cookingEvent('cooking_restored', userId),
    // Recorded only for one that was deleted.
    { earlier: sql`select ${cooking.id} from ${cooking} where ${and(target, isNotNull(cooking.deletedAt))}` },
  )
  const [row] = await selectCookings().where(target)
  return row ? toView(row) : null
}
