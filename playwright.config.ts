import { defineConfig } from '@playwright/test'

const PORT = 3100

// Start through `pnpm test:e2e` (tests/e2e/run.ts): it creates a throwaway
// local database, points DATABASE_URL at it, and drops it afterwards.
if (!process.env.MALKOCHEN_E2E) {
  throw new Error('Run the browser tests with `pnpm test:e2e`, not Playwright directly.')
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Never reuse: a server started outside this run would be on another database.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
