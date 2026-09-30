import { drizzle as drizzleNeon, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'
import { parseServerEnv } from '../env'
import * as schema from './schema'
import { isLocalDatabaseUrl } from './url'

// A localhost DATABASE_URL (dev and the throwaway test databases) gets
// node-postgres; Neon in deployed environments gets neon-http. Both expose the
// same query-builder API, so `db` keeps the neon type and callers compile
// against one shape. Atomic writes differ: neon-http has only db.batch,
// node-postgres only db.transaction, and the cast hides that. Call neither
// directly -- the first ticket that needs atomic writes adds a runAtomic()
// helper covering both drivers (malmachen's server/db/index.ts has one).
export type Db = NeonHttpDatabase<typeof schema>

const url = parseServerEnv(process.env).DATABASE_URL

export const db: Db = isLocalDatabaseUrl(url)
  ? drizzlePg(new pg.Pool({ connectionString: url }), { schema }) as unknown as Db
  : drizzleNeon(neon(url), { schema })
