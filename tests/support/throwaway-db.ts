import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { migrateDatabase } from '../../server/db/migrate'

// Every test run (Vitest API tests and Playwright) gets its own local Postgres
// database, migrated from scratch and dropped afterwards, so tests never touch
// Neon and never see each other's rows. `adminUrl` is a superuser URL of the
// local Postgres (TEST_DATABASE_ADMIN_URL).
export const RUN_DB_PREFIX = 'malkochen_test_'

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`

export function readAdminUrl(): string {
  const url = process.env.TEST_DATABASE_ADMIN_URL
  if (!url) {
    throw new Error(
      'TEST_DATABASE_ADMIN_URL is not set. Add it to .env, '
      + 'e.g. postgres://postgres:postgres@localhost:5432/postgres',
    )
  }
  return url
}

async function admin<T>(adminUrl: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: adminUrl })
  try {
    await client.connect()
  }
  catch (err) {
    throw new Error(`Cannot reach local Postgres at ${new URL(adminUrl).host}. Is it running?`, { cause: err })
  }
  try {
    return await fn(client)
  }
  finally {
    await client.end()
  }
}

function withDatabase(adminUrl: string, name: string): string {
  const u = new URL(adminUrl)
  u.pathname = `/${name}`
  return u.toString()
}

// Leftovers of hard-killed runs. Concurrent runs are unsupported, so any
// database with the prefix that is older than this run is stale.
async function sweep(adminUrl: string) {
  const { rows } = await admin(adminUrl, c => c.query<{ datname: string }>(
    'SELECT datname FROM pg_database WHERE starts_with(datname, $1)', [RUN_DB_PREFIX]))
  for (const { datname } of rows) {
    await admin(adminUrl, c => c.query(`DROP DATABASE IF EXISTS ${quote(datname)} WITH (FORCE)`))
  }
}

export async function createThrowawayDatabase(adminUrl: string): Promise<{ url: string, drop: () => Promise<void> }> {
  await sweep(adminUrl)
  const name = `${RUN_DB_PREFIX}${Date.now()}_${randomBytes(3).toString('hex')}`
  await admin(adminUrl, c => c.query(`CREATE DATABASE ${quote(name)}`))
  const url = withDatabase(adminUrl, name)
  await migrateDatabase(url)
  return {
    url,
    drop: () => admin(adminUrl, c => c.query(`DROP DATABASE IF EXISTS ${quote(name)} WITH (FORCE)`)).then(() => {}),
  }
}
