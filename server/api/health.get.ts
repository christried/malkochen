import { sql } from 'drizzle-orm'
import { db } from '../db'

// Liveness plus a database round trip. Reads Drizzle's own migration journal,
// so "ok" means the database is reachable AND has been migrated.
export default defineEventHandler(async () => {
  const result = await db.execute<{ applied: number }>(
    sql`select count(*)::int as applied from drizzle.__drizzle_migrations`)
  const applied = 'rows' in result ? result.rows[0]?.applied : undefined
  return { status: 'ok', database: applied ? 'ok' : 'unmigrated' }
})
