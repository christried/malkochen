import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { BatchItem } from 'drizzle-orm/batch'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'
import { parseDatabaseEnv } from '../env'
import * as schema from './schema'
import { isLocalDatabaseUrl } from './url'

// A localhost DATABASE_URL (dev and the throwaway test databases) gets
// node-postgres; Neon in deployed environments gets neon-http. Both expose the
// same query-builder API, so `db` keeps the neon type and callers compile
// against one shape. Atomic writes differ: neon-http has only db.batch,
// node-postgres only db.transaction, and the cast hides that. Call neither
// directly: use runAtomic() below.
export type Db = NeonHttpDatabase<typeof schema>

const url = parseDatabaseEnv(process.env).DATABASE_URL
const pgDb: NodePgDatabase<typeof schema> | null = isLocalDatabaseUrl(url)
  ? drizzlePg(new pg.Pool({ connectionString: url }), { schema })
  : null

export const db: Db = pgDb
  ? pgDb as unknown as Db
  : drizzleNeon(neon(url), { schema })

// All-or-nothing writes: one transaction on either driver (neon-http runs a
// batch as one). Statements run in order, each seeing the ones before it.
// `build` gets the handle to build them on -- on node-postgres that must be
// the transaction, not the pool.
export async function runAtomic(build: (d: Db) => BatchItem<'pg'>[]): Promise<void> {
  if (pgDb) {
    await pgDb.transaction(async (tx) => {
      for (const statement of build(tx as unknown as Db)) await statement
    })
    return
  }
  const [first, ...rest] = build(db)
  if (first) await db.batch([first, ...rest])
}
