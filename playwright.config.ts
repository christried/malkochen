import { defineConfig } from '@playwright/test'
import { E2E_ORIGIN } from './tests/support/test-auth-env'

const PORT = new URL(E2E_ORIGIN).port

// Start through `pnpm test:e2e` (tests/e2e/run.ts): it creates a throwaway
// local database, points DATABASE_URL at it, and drops it afterwards.
if (!process.env.MALKOCHEN_E2E) {
  throw new Error('Run the browser tests with `pnpm test:e2e`, not Playwright directly.')
}

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  // CI retries a failed test once, so a flake doesn't cost a whole rerun; the
  // report still marks it flaky. Locally a failure stays a failure.
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: E2E_ORIGIN,
    // A German browser (navigator.languages, Accept-Language), so malkochen
    // speaks German with "Automatisch", as the specs expect. languages.spec.ts
    // tries others.
    locale: 'de-DE',
    // page.route can't see requests that pass through a service worker, and
    // many tests stub the API that way. offline.spec.ts lets it run.
    serviceWorkers: 'block',
    // A flake that passes on rerun leaves nothing to find its cause in
    // (#233), so each test's first try is traced and kept if it fails, also
    // when CI's retry then passes. CI uploads test-results/.
    trace: 'retain-on-first-failure',
  },
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: E2E_ORIGIN,
    // Never reuse: a server started outside this run would be on another database.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
