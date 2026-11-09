import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { SourceKind } from '../source-lookup'
import { db } from '../db'
import { cooking, dish, snackbertReport } from '../db/schema'
import type { SnackbertReportFile } from '../snackbert'
import { REPORT_DISH_IMAGE_MAX_BYTES, REPORT_DISH_IMAGE_TYPES } from '../snackbert/report-input'
import { accessibleBoardIds } from './board-access'
import { snackbertReportEvent, withEvents } from './events'
import { readStoredImage } from './image-store'

// Snackbert Reports (CONTEXT.md: Snackbert Report, #424): a Member tells
// Snackbert they ate a Cooking, with its Dish's details, and if they like a
// photo of their portion, a recording and words about it. What Snackbert makes
// of it stays in Snackbert. malkochen keeps only that the Member reported the
// Cooking (snackbert_report), so they see it as reported, and its Event Log
// event. The route is server/api/cookings/[id]/snackbert-report.post.ts.

// A Cooking a Member may report, with what Snackbert is told of its Dish.
export interface ReportableCooking {
  id: string
  cookedAt: Date
  dish: {
    title: string
    sourceLink: string | null
    sourceKind: SourceKind | null
    creator: string | null
    caption: string | null
    imageUrl: string | null
    // Whether imageUrl is the Member's own photo (#424), else the Source image.
    imageIsOwnPhoto: boolean
  }
}

// The Cooking if the user may report it: not deleted, its Dish not archived,
// on a Board they may see. Any Member may report for themselves, whatever
// their Permissions. Null otherwise.
export async function reportableCooking(cookingId: string, userId: string): Promise<ReportableCooking | null> {
  const [found] = await db
    .select({
      id: cooking.id,
      cookedAt: cooking.cookedAt,
      title: dish.title,
      sourceLink: dish.sourceLink,
      sourceKind: dish.sourceKind,
      creator: dish.creator,
      caption: dish.caption,
      imageUrl: dish.imageUrl,
      imageIsOwnPhoto: dish.imageIsOwnPhoto,
    })
    .from(cooking)
    .innerJoin(dish, eq(dish.id, cooking.dishId))
    .where(and(
      eq(cooking.id, cookingId),
      isNull(cooking.deletedAt),
      isNull(dish.deletedAt),
      inArray(dish.boardId, accessibleBoardIds(userId)),
    ))
  if (!found) return null
  return {
    id: found.id,
    cookedAt: found.cookedAt,
    dish: {
      title: found.title,
      sourceLink: found.sourceLink,
      sourceKind: found.sourceKind,
      creator: found.creator,
      caption: found.caption,
      imageUrl: found.imageUrl,
      imageIsOwnPhoto: found.imageIsOwnPhoto,
    },
  }
}

// The Dish's image as Snackbert takes it, or null to send the Report without
// one: no image (a Placeholder), one that can't be read, or not a JPEG, PNG or
// WebP of at most REPORT_DISH_IMAGE_MAX_BYTES.
export async function dishImageFor(found: ReportableCooking['dish']): Promise<(SnackbertReportFile & { kind: 'post' | 'ownPhoto' }) | null> {
  if (!found.imageUrl) return null
  const image = await readStoredImage(found.imageUrl)
  if (!image) return null
  if (!(REPORT_DISH_IMAGE_TYPES as readonly string[]).includes(image.type) || image.bytes.length > REPORT_DISH_IMAGE_MAX_BYTES) {
    console.warn(`[snackbert] Report sent without the Dish image: not a JPEG, PNG or WebP of up to 5 MB (${found.imageUrl})`)
    return null
  }
  return { ...image, kind: found.imageIsOwnPhoto ? 'ownPhoto' : 'post' }
}

// Records that the user sent a Snackbert Report for the Cooking, with its
// Event Log event, in one statement. Only the fact: nothing of the Report.
export async function recordSnackbertReport(cookingId: string, userId: string): Promise<void> {
  await withEvents(
    db,
    db.insert(snackbertReport).values({ cookingId, userId }).returning({ id: snackbertReport.id, cookingId: snackbertReport.cookingId }),
    snackbertReportEvent('snackbert_report_sent', userId),
  )
}

// The live Cookings of the Dish the user has sent a Report for (distinct),
// for the Dish's detail to show as reported to them alone.
export async function reportedCookings(dishId: string, userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ cookingId: snackbertReport.cookingId })
    .from(snackbertReport)
    .innerJoin(cooking, eq(cooking.id, snackbertReport.cookingId))
    .where(and(eq(cooking.dishId, dishId), isNull(cooking.deletedAt), eq(snackbertReport.userId, userId)))
  return rows.map(row => row.cookingId)
}
