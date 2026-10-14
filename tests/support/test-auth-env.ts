// Where the browser tests' dev server listens (playwright.config.ts).
export const E2E_ORIGIN = 'http://localhost:3100'

// Auth settings for every test server (API and browser tests), overriding
// whatever .env holds: a fixed Allowlist, the dev sign-in bypass, and dummy
// Google credentials (Google itself is never called in tests).
// The test Allowlist; any other email is refused.
export const ALLOWLISTED = ['ada@example.com', 'grace@example.com', 'linus@example.com', 'margaret@example.com', 'barbara@example.com', 'katherine@example.com', 'hedy@example.com', 'mary@example.com', 'ida@example.com', 'annie@example.com', 'joan@example.com', 'radia@example.com', 'frances@example.com', 'sophie@example.com', 'evelyn@example.com', 'alan@example.com', 'dorothy@example.com', 'ruth@example.com', 'jean@example.com', 'emmy@example.com', 'lise@example.com', 'hertha@example.com', 'rosalind@example.com', 'chien-shiung@example.com', 'katalin@example.com', 'hypatia@example.com', 'mileva@example.com', 'maria@example.com', 'inge@example.com', 'grete@example.com', 'youyou@example.com', 'maryam@example.com', 'jocelyn@example.com', 'hilde@example.com', 'marie@example.com', 'emilie@example.com', 'rachel@example.com', 'mae@example.com', 'florence@example.com', 'stephanie@example.com', 'gladys@example.com', 'shafi@example.com', 'vera@example.com', 'cecilia@example.com', 'edith@example.com', 'lynn@example.com', 'tu@example.com', 'chien@example.com', 'nettie@example.com', 'gerty@example.com', 'mcclintock@example.com', 'elion@example.com', 'rosa@example.com', 'meitner@example.com', 'noether@example.com', 'curie@example.com', 'franklin@example.com', 'hodgkin@example.com', 'kohn@example.com', 'lovelace@example.com', 'easley@example.com', 'keller@example.com', 'granville@example.com', 'hamilton@example.com', 'johnson@example.com', 'goldberg@example.com'] as const

// A first sign-in's name and Google photo, as Google would send them; later
// sign-ins keep the first. The dev sign-in takes them for the tests, and
// whether Google says the email is verified (yes unless said otherwise).
// Unlike after Google, a new user has a Username already, made from that
// name, so a test starts on a Board: `username` says otherwise, for the
// tests of the two prompts ('none': as Google leaves a new user;
// 'suggested': as the migration left a user from before Usernames).
export interface Profile {
  name?: string
  image?: string
  emailVerified?: boolean
  username?: 'none' | 'suggested'
}

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
