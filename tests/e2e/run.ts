import 'dotenv/config'
import { spawn } from 'node:child_process'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'

// `pnpm test:e2e [playwright args]`: runs Playwright against its own throwaway
// local database, dropped afterwards whatever the outcome.
async function main(): Promise<number> {
  const database = await createThrowawayDatabase(readAdminUrl())
  try {
    return await new Promise<number>((resolve, reject) => {
      // cmd.exe-style quoting (local dev is Windows). CI passes no arguments.
      const args = process.argv.slice(2).map(a => /[\s"]/.test(a) ? `"${a.replaceAll('"', '""')}"` : a)
      const child = spawn(['pnpm', 'exec', 'playwright', 'test', ...args].join(' '), {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, DATABASE_URL: database.url, MALKOCHEN_E2E: '1' },
      })
      // Ctrl+C reaches Playwright directly; the wrapper only outlives it so
      // `finally` can drop the database.
      process.on('SIGINT', () => {})
      child.on('error', reject)
      child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
    })
  }
  finally {
    await database.drop()
  }
}

main().then(code => process.exit(code), (err) => {
  console.error(err)
  process.exit(1)
})
