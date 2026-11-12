import { sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'

// Changes that can arrive late, or twice (CONTEXT.md: Unsent Change; ADR
// 0012). A change made offline is sent once malkochen answers again, as the
// same request it would have been online, with two optional extras:
// - an id made on the device for what it adds (a Dish, a Cooking, a
//   Comment), which the server keeps as the row's id. A repeat with the
//   same id, by the same user on the same Dish or Board, is already done: it
//   records nothing new and answers as if it had just been made. An id
//   another user's or another Dish's row has is refused (session.ts idTaken).
// - the time it was made, which dates a Cooking, a Comment or a Vote. It is
//   clamped to no later than its arrival; whatever goes by arrival reads
//   the row's `arrivedAt` instead (schema.ts). On a move it marks one sent
//   late, whose Column may have been deleted meanwhile (dishes.ts
//   columnOrFirst).

// The id made on the device for the row a change adds.
export const deviceIdInput = z.uuid().optional()

// When the change was made, with its offset (as `toISOString()` writes it).
export const madeAtInput = z.iso.datetime({ offset: true }).optional()

// The time a row is dated: when the change was made, never later than now
// (a phone with a wrong clock can't date things in the future); without
// one, now.
export function madeAtOrNow(madeAt: string | undefined): SQL {
  return madeAt === undefined ? sql`now()` : sql`least(${madeAt}::timestamptz, now())`
}

// How a device-made id stands: free (not used yet), a repeat of the same
// change (already done), or taken by another user's, Dish's or Board's row.
export type DeviceIdStanding = 'free' | 'repeat' | 'taken'

// Postgres' unique_violation, from either driver (node-postgres puts it on
// the error, Drizzle may wrap that as its cause): a username taken, or a
// device-made id a repeat arriving at the same moment wrote first.
export function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code
  return code(err) === '23505' || code((err as { cause?: unknown } | null)?.cause) === '23505'
}

// Runs `write` once only, for a device-made id: first asks how the id
// stands (`standing`), and writes only a free one. When a repeat arriving at
// the same moment wrote it first (unique violation), asks again. Answers how
// it stood: 'free' once written. Without an id (no `standing`), just writes.
export async function writeOnce(standing: (() => Promise<DeviceIdStanding>) | undefined, write: () => Promise<unknown>): Promise<DeviceIdStanding> {
  if (!standing) {
    await write()
    return 'free'
  }
  const before = await standing()
  if (before !== 'free') return before
  try {
    await write()
    return 'free'
  }
  catch (err) {
    if (!isUniqueViolation(err)) throw err
    const after = await standing()
    if (after === 'free') throw err
    return after
  }
}
