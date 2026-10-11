import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { db } from '../db'
import { rateLimitUse } from '../db/schema'
import { RATE_LIMITS, type RateLimited } from '../rate-limits'

// Counts one more of the user's calls to `limited` before the work is done,
// so calls sent at once can't all slip under the limit: one more in the
// user's window, or the first of a new one. Over the limit it throws 429,
// which the app shows kindly where it can happen. Built like
// the Invite Link misses (server/utils/invites.ts): a fixed window and a
// counter, per user rather than per IP address.
export async function spendRateLimit(userId: string, limited: RateLimited): Promise<void> {
  const { calls, window } = RATE_LIMITS[limited]
  const windowOver = sql`now() - ${window}::interval`
  const inWindow = gt(rateLimitUse.windowStart, windowOver)
  const [counted] = await db
    .insert(rateLimitUse)
    .values({ userId, limited })
    .onConflictDoUpdate({
      target: [rateLimitUse.userId, rateLimitUse.limited],
      set: {
        calls: sql`case when ${inWindow} then ${rateLimitUse.calls} + 1 else 1 end`,
        windowStart: sql`case when ${inWindow} then ${rateLimitUse.windowStart} else now() end`,
      },
    })
    .returning({ calls: rateLimitUse.calls, newWindow: sql<boolean>`${rateLimitUse.windowStart} = now()` })
  // Windows that are over need no row; cleared once per new window, not on
  // every call.
  if (counted?.newWindow) {
    await db.delete(rateLimitUse).where(and(eq(rateLimitUse.limited, limited), lt(rateLimitUse.windowStart, windowOver)))
  }
  if ((counted?.calls ?? 0) > calls) throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
}
