import 'dotenv/config'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { createThrowawayDatabase, readAdminUrl } from '../../tests/support/throwaway-db'
import { testAuthEnv } from '../../tests/support/test-auth-env'
import { CAPTURE_ORIGIN, OUT_DIR, SERVER_FILE } from './settings'

// The app the brag video is captured from: `pnpm dev` on its own throwaway
// local database, with the browser tests' settings (dev sign-in, test
// Allowlist, no Tour starting by itself, no dev error overlay). Runs until
// stopped (Ctrl+C), then drops the database. capture.ts reads where it is
// from SERVER_FILE.
async function main() {
  const database = await createThrowawayDatabase(readAdminUrl())
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(SERVER_FILE, JSON.stringify({ origin: CAPTURE_ORIGIN, databaseUrl: database.url }))
  const child = spawn(`pnpm dev --port ${new URL(CAPTURE_ORIGIN).port}`, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...testAuthEnv(CAPTURE_ORIGIN), DATABASE_URL: database.url, MALKOCHEN_E2E: '1' },
  })
  const stop = async () => {
    child.kill()
    await database.drop()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  child.on('exit', async (code) => {
    await database.drop()
    process.exit(code ?? 0)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
