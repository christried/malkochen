import { sql } from 'drizzle-orm'
import { db } from '../db'

// Liveness plus a database round trip. Reads Drizzle's own migration journal,
// which only exists once migrations ran: an unreachable or unmigrated
// database makes the query throw, so the endpoint answers 500.
export default defineEventHandler(async () => {
  await db.execute(sql`select 1 from drizzle.__drizzle_migrations limit 1`)
  return { status: 'ok', database: 'ok' }
})
