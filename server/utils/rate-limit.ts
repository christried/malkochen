import { and, eq, gt, lt, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db } from '../db'
import { addressLimitUse, rateLimitUse } from '../db/schema'
import { ADDRESS_RATE_LIMITS, RATE_LIMITS, type AddressRateLimited, type RateLimited } from '../rate-limits'

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
// client): counts one more call to `limited`, and says whether the address
// is still within its limit. It doesn't throw: what to do over the limit is
// the caller's to decide.
export async function withinAddressLimit(event: H3Event, limited: AddressRateLimited): Promise<boolean> {
  const { calls, window } = ADDRESS_RATE_LIMITS[limited]
  const address = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const windowOver = sql`now() - ${window}::interval`
  const inWindow = gt(addressLimitUse.windowStart, windowOver)
  const [counted] = await db
    .insert(addressLimitUse)
    .values({ address, limited })
    .onConflictDoUpdate({
      target: [addressLimitUse.address, addressLimitUse.limited],
      set: {
        calls: sql`case when ${inWindow} then ${addressLimitUse.calls} + 1 else 1 end`,
        windowStart: sql`case when ${inWindow} then ${addressLimitUse.windowStart} else now() end`,
      },
    })
    .returning({ calls: addressLimitUse.calls, newWindow: sql<boolean>`${addressLimitUse.windowStart} = now()` })
  if (counted?.newWindow) {
    await db.delete(addressLimitUse).where(and(eq(addressLimitUse.limited, limited), lt(addressLimitUse.windowStart, windowOver)))
  }
  return (counted?.calls ?? 0) <= calls
}
