// Where the browser tests' dev server listens (playwright.config.ts).
export const E2E_ORIGIN = 'http://localhost:3100'

// Auth settings for every test server (API and browser tests), overriding
// whatever .env holds: a fixed Allowlist, the dev sign-in bypass, and dummy
// Google credentials (Google itself is never called in tests).
// The test Allowlist; any other email is refused.
export const ALLOWLISTED = ['ada@example.com', 'grace@example.com', 'linus@example.com', 'margaret@example.com', 'barbara@example.com', 'katherine@example.com', 'hedy@example.com', 'mary@example.com', 'ida@example.com', 'annie@example.com', 'joan@example.com', 'radia@example.com', 'frances@example.com', 'sophie@example.com', 'evelyn@example.com', 'alan@example.com', 'dorothy@example.com', 'ruth@example.com', 'jean@example.com'] as const

export function testAuthEnv(baseUrl: string): Record<string, string> {
  return {
    BETTER_AUTH_URL: baseUrl,
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-0123',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    // Spaces around entries on purpose: the Allowlist must ignore them.
    ALLOWLIST_EMAILS: ALLOWLISTED.join(' , '),
    AUTH_DEV_BYPASS: '1',
  }
}
