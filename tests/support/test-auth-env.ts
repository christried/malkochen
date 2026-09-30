// Where the browser tests' dev server listens (playwright.config.ts).
export const E2E_ORIGIN = 'http://localhost:3100'

// Auth settings for every test server (API and browser tests), overriding
// whatever .env holds: a fixed Allowlist, the dev sign-in bypass, and dummy
// Google credentials (Google itself is never called in tests).
// Keep in sync with ALLOWLISTED in tests/api/client.ts.
export function testAuthEnv(baseUrl: string): Record<string, string> {
  return {
    BETTER_AUTH_URL: baseUrl,
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-0123',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    ALLOWLIST_EMAILS: 'ada@example.com, grace@example.com,linus@example.com',
    AUTH_DEV_BYPASS: '1',
  }
}
