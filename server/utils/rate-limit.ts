import { and, eq, gt, lt, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db } from '../db'
import { clientLimitUse, rateLimitUse } from '../db/schema'
import { CLIENT_RATE_LIMITS, RATE_LIMITS, type ClientRateLimited, type RateLimited } from '../rate-limits'

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

// The same for a caller without a session, told apart by IP address (on
// Vercel x-forwarded-for is the visitor's, set by Vercel and not by the
// client): counts one more call to `limited`, and says whether the client
// is still within its limit. It doesn't throw: what to do over the limit is
// the caller's to decide.
export async function withinClientLimit(event: H3Event, limited: ClientRateLimited): Promise<boolean> {
  return await spendClientLimit(getRequestIP(event, { xForwardedFor: true }) ?? 'unknown', limited) === null
}

// Counts one more call to `limited` by `client` (an IP address, or what else
// tells callers apart, such as the email address a sign-in code goes to).
// Answers null within the limit; over it, when the window is over and calls
// go through again.
export async function spendClientLimit(client: string, limited: ClientRateLimited): Promise<Date | null> {
  const { calls, window } = CLIENT_RATE_LIMITS[limited]
  const windowOver = sql`now() - ${window}::interval`
  const inWindow = gt(clientLimitUse.windowStart, windowOver)
  const [counted] = await db
    .insert(clientLimitUse)
    .values({ client, limited })
    .onConflictDoUpdate({
      target: [clientLimitUse.client, clientLimitUse.limited],
      set: {
        calls: sql`case when ${inWindow} then ${clientLimitUse.calls} + 1 else 1 end`,
        windowStart: sql`case when ${inWindow} then ${clientLimitUse.windowStart} else now() end`,
      },
    })
    .returning({
      calls: clientLimitUse.calls,
      newWindow: sql<boolean>`${clientLimitUse.windowStart} = now()`,
      windowEnd: sql<string>`${clientLimitUse.windowStart} + ${window}::interval`,
    })
  if (counted?.newWindow) {
    await db.delete(clientLimitUse).where(and(eq(clientLimitUse.limited, limited), lt(clientLimitUse.windowStart, windowOver)))
  }
  return counted && counted.calls > calls ? new Date(counted.windowEnd) : null
}
