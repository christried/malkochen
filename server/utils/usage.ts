import { sql } from 'drizzle-orm'
import { db } from '../db'
import { usageCount } from '../db/schema'

// What the Admin Page (#348) counts against the free tiers and no other
// table holds (server/db/schema.ts usageCount): emails Resend took, and the
// polls of open Boards.
export type UsageKind = 'email' | 'poll'

// Polls are counted one in this many, this many at a time: an estimate that
// writes once every ten polls rather than on each.
export const POLL_SAMPLE = 10

const today = sql`(now() at time zone 'utc')::date`

// Adds `count` to today's count of `kind`.
export async function countUsage(kind: UsageKind, count: number): Promise<void> {
  if (count <= 0) return
  await db.insert(usageCount)
    .values({ day: today, kind, count })
    .onConflictDoUpdate({ target: [usageCount.day, usageCount.kind], set: { count: sql`${usageCount.count} + ${count}` } })
}

// One poll of an open Board (GET /api/boards/:id/version), counted by chance.
// Never rejects: a count missed must not fail the poll.
export async function countPoll(random = Math.random): Promise<void> {
  if (random() >= 1 / POLL_SAMPLE) return
  await countUsage('poll', POLL_SAMPLE).catch(error => console.warn(`[usage] poll not counted: ${error}`))
}
