import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import { neon } from '@neondatabase/serverless'
import pg from 'pg'
import { isLocalDatabaseUrl } from './url'

// Applies the committed migrations under server/db/migrations. On Neon it uses
// the same neon-http (fetch) driver the app uses -- deliberately NOT
// `drizzle-kit migrate`, which goes through @neondatabase/serverless's
// WebSocket transport and fails in a plain Node process. A localhost URL
// (dev and the throwaway test databases) uses node-postgres.
const MIGRATIONS = { migrationsFolder: './server/db/migrations' }

export async function migrateDatabase(url: string): Promise<void> {
  if (isLocalDatabaseUrl(url)) {
    const pool = new pg.Pool({ connectionString: url })
    try {
      await migratePg(drizzlePg(pool), MIGRATIONS)
    }
    finally {
      await pool.end()
    }
  }
  else {
    await migrateNeon(drizzleNeon(neon(url)), MIGRATIONS)
  }
}
