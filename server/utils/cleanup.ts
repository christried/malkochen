import { isNotNull, lt, sql } from 'drizzle-orm'
import { db } from '../db'
import { cooking, dish, user } from '../db/schema'
import { sweepImages } from '../image-store/sweep'
import { storage } from './image-store'

// The daily cleanup job (#195; server/api/cron/cleanup.get.ts). Deleted
// Dishes and Cookings stay restorable this long, then are purged for good.
// Neon's own restore window is a day, so this is the main way back from a
// deletion.
const RESTORABLE_FOR = '30 days'

export interface CleanupReport {
  purgedDishes: number
  purgedCookings: number
  deletedImages: number
}

export async function cleanUp(): Promise<CleanupReport> {
  // A purged Dish takes its Cookings along (on delete cascade).
  const deletedBefore = sql`now() - ${RESTORABLE_FOR}::interval`
  const purgedDishes = await db.delete(dish).where(lt(dish.deletedAt, deletedBefore)).returning({ id: dish.id })
  const purgedCookings = await db.delete(cooking).where(lt(cooking.deletedAt, deletedBefore)).returning({ id: cooking.id })

  // Read after the purge, so the purged Dishes' images go in the same sweep.
  // A deleted Dish still restorable keeps its image.
  const [dishImages, pictures] = await Promise.all([
    db.select({ url: dish.imageUrl }).from(dish).where(isNotNull(dish.imageUrl)),
    db.select({ url: user.ownPicture }).from(user).where(isNotNull(user.ownPicture)),
  ])
  const referenced = new Set([...dishImages, ...pictures].map(row => row.url))
  const deleted = await sweepImages({ storage, isReferenced: url => referenced.has(url), referenceCount: referenced.size })

  return { purgedDishes: purgedDishes.length, purgedCookings: purgedCookings.length, deletedImages: deleted.length }
}
