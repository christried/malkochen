import { and, asc, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { db } from '../db'
import { dish, setting } from '../db/schema'
import type { SourceLookup, SourceLookupResult } from '../source-lookup'
import { lookupSource } from './source-lookup'
import { playableFor } from './source-ticket'

// The backfill of Captions and playable videos (#395): Dishes added before
// #393 and #394 have no Caption and no known playable video. Source Lookup
// reads each one's Source again, a few per batch, oldest first, until the
// time budget is spent. Run daily from the cleanup route
// (server/api/cron/cleanup.get.ts), and by hand from /api/cron/source-facts.
// It writes no Event Log rows and sends no Push. Each Dish it fills still moves
// its Board's Version (the dish trigger, migration 0032), which is accepted:
// an open Board reloads once, and then shows the Captions.

export interface SourceFactsReport {
  done: boolean
  // Dishes given their facts in this run, unreachable ones included.
  filled: number
  // Of those, the ones Source Lookup could not read: marked handled anyway.
  unreachable: number
  // Dishes still waiting after this run.
  left: number
}

export interface FillOptions {
  lookup?: SourceLookup
  // The time budget: no new batch starts after it is spent. A batch in flight
  // finishes (Source Lookup's own timeout bounds it).
  budgetMs?: number
  concurrency?: number
  now?: () => number
}

const waiting = and(isNotNull(dish.sourceLink), isNull(dish.playableVideo))

// True for the answer Source Lookup gives when it found nothing but the
// link's own guess (server/source-lookup/types.ts nothingFound).
function foundNothing(found: SourceLookupResult): boolean {
  return found.suggestedTitle === '' && found.creator === null && found.imageUrl === null && found.caption === null
}

export async function fillSourceFacts({
  lookup = lookupSource,
  budgetMs = 30_000,
  concurrency = 3,
  now = Date.now,
}: FillOptions = {}): Promise<SourceFactsReport> {
  const [marked] = await db.select({ at: setting.sourceFactsFilledAt }).from(setting)
  if (marked?.at) return { done: true, filled: 0, unreachable: 0, left: 0 }

  let filled = 0
  let unreachable = 0
  const deadline = now() + budgetMs
  while (now() < deadline) {
    const batch = await db.select({ id: dish.id, link: dish.sourceLink, kind: dish.sourceKind })
      .from(dish)
      .where(waiting)
      .orderBy(asc(dish.createdAt), asc(dish.id))
      .limit(concurrency)
    if (batch.length === 0) break

    const results = await Promise.all(batch.map(async (row) => {
      const link = row.link!
      const kind = row.kind ?? 'other'
      const found = await lookup(link).catch((): SourceLookupResult | null => null)
      const isUnreachable = found === null || (kind.startsWith('instagram') && foundNothing(found))
      // Unreachable: no Caption, no video known to play: handled, never asked again.
      const caption = found?.caption ?? null
      const playable = found !== null && !isUnreachable ? playableFor({ link, kind }, found.playableVideo) : false
      // Only a Dish still without a value gets one: a Member's edit meanwhile
      // (playable_video set) stands, and a Caption already there is kept.
      await db.update(dish)
        .set({ caption: sql`coalesce(${dish.caption}, ${caption})`, playableVideo: playable })
        .where(and(eq(dish.id, row.id), isNull(dish.playableVideo)))
      return isUnreachable
    }))
    filled += results.length
    unreachable += results.filter(Boolean).length
  }

  const [counted] = await db.select({ left: count() }).from(dish).where(waiting)
  const left = counted?.left ?? 0
  const done = left === 0
  if (done) {
    await db.update(setting).set({ sourceFactsFilledAt: sql`now()` }).where(isNull(setting.sourceFactsFilledAt))
    console.info('[source-facts] done')
  }
  return { done, filled, unreachable, left }
}

// The run's report on one line, when it did anything (server log).
export function logSourceFacts(report: SourceFactsReport): void {
  if (report.filled === 0 && report.left === 0) return
  console.info(`[source-facts] filled ${report.filled}, unreachable ${report.unreachable}, ${report.left} left`)
}
