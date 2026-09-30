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
// against one shape. neon-http has no interactive transactions -- use
// db.batch there when later tickets need atomic writes.
export type Db = NeonHttpDatabase<typeof schema>

const url = parseServerEnv(process.env).DATABASE_URL

export const db: Db = isLocalDatabaseUrl(url)
  ? drizzlePg(new pg.Pool({ connectionString: url }), { schema }) as unknown as Db
  : drizzleNeon(neon(url), { schema })
