import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { migrateDatabase } from '../../server/db/migrate'

// Every test run (Vitest API tests and Playwright) gets its own local Postgres
// database, migrated from scratch and dropped afterwards, so tests never touch
// Neon and never see each other's rows. `adminUrl` is a superuser URL of the
// local Postgres (TEST_DATABASE_ADMIN_URL).
const RUN_DB_PREFIX = 'malkochen_test_'
// A run database older than this belongs to a hard-killed run, not to a
// concurrent one (`pnpm test` and `pnpm test:e2e` may run side by side).
const STALE_AFTER_MS = 6 * 60 * 60 * 1000

const quoteIdent = (name: string) => `"${name.replaceAll('"', '""')}"`

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

async function withAdminClient<T>(adminUrl: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
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
  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  return url.toString()
}

async function dropDatabase(adminUrl: string, name: string): Promise<void> {
  await withAdminClient(adminUrl, c => c.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`))
}

// Leftovers of hard-killed runs, recognised by the creation time in the name.
async function sweep(adminUrl: string) {
  const { rows } = await withAdminClient(adminUrl, c => c.query<{ datname: string }>(
    'SELECT datname FROM pg_database WHERE starts_with(datname, $1)', [RUN_DB_PREFIX]))
  for (const { datname } of rows) {
    const createdAt = Number(datname.slice(RUN_DB_PREFIX.length).split('_')[0])
    if (Date.now() - createdAt > STALE_AFTER_MS) await dropDatabase(adminUrl, datname)
  }
}

// Migrated with the migrations in `migrationsFolder`, all of them by default.
export async function createThrowawayDatabase(adminUrl: string, migrationsFolder?: string): Promise<{ url: string, drop: () => Promise<void> }> {
  await sweep(adminUrl)
  const name = `${RUN_DB_PREFIX}${Date.now()}_${randomBytes(3).toString('hex')}`
  await withAdminClient(adminUrl, c => c.query(`CREATE DATABASE ${quoteIdent(name)}`))
  const url = withDatabase(adminUrl, name)
  const drop = () => dropDatabase(adminUrl, name)
  try {
    await migrateDatabase(url, migrationsFolder)
  }
  catch (err) {
    await drop()
    throw err
  }
  return { url, drop }
}
