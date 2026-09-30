// The one rule for "local Postgres" versus "Neon". Shared by the app's driver
// choice (server/db/index.ts) and the migrator (server/db/migrate.ts), so the
// two can never disagree.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname)
  }
  catch {
    return false
  }
}
