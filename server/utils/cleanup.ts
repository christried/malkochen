import { eq, isNotNull, lt, or, sql } from 'drizzle-orm'
import { db } from '../db'
import { cooking, dish, user } from '../db/schema'
import { sweepImages } from '../image-store/sweep'
import { RESTORABLE_FOR } from './dishes'
import { storage } from './image-store'

// The daily cleanup job (#195; server/api/cron/cleanup.get.ts). Archived
// Dishes and deleted Cookings stay restorable for RESTORABLE_FOR, then are
// purged for good. Neon's own restore window is a day, so this is the main
// way back from a deletion.

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

// Removes a stored image at once, unless a Dish or a user still refers to
// it: what a Dish deleted for good leaves behind (server/utils/dishes.ts
// purgeDish), rather than waiting for the daily sweep.
export async function removeImageIfUnreferenced(url: string): Promise<void> {
  const [dishUsing] = await db.select({ id: dish.id }).from(dish).where(eq(dish.imageUrl, url)).limit(1)
  const [userUsing] = await db.select({ id: user.id }).from(user).where(or(eq(user.ownPicture, url), eq(user.image, url))).limit(1)
  if (dishUsing || userUsing) return
  await storage.remove([url])
}
