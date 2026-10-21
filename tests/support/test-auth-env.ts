// Where the browser tests' dev server listens (playwright.config.ts).
export const E2E_ORIGIN = 'http://localhost:3100'

// Auth settings for every test server (API and browser tests), overriding
// whatever .env holds: a fixed Allowlist, the dev sign-in bypass, and dummy
// Google credentials (Google itself is never called in tests).
// The test Allowlist; any other email is refused.
export const ALLOWLISTED = ['ada@example.com', 'grace@example.com', 'linus@example.com', 'margaret@example.com', 'barbara@example.com', 'katherine@example.com', 'hedy@example.com', 'mary@example.com', 'ida@example.com', 'annie@example.com', 'joan@example.com', 'radia@example.com', 'frances@example.com', 'sophie@example.com', 'evelyn@example.com', 'alan@example.com', 'dorothy@example.com', 'ruth@example.com', 'jean@example.com', 'emmy@example.com', 'lise@example.com', 'hertha@example.com', 'rosalind@example.com', 'chien-shiung@example.com', 'katalin@example.com', 'hypatia@example.com', 'mileva@example.com', 'maria@example.com', 'inge@example.com', 'grete@example.com', 'youyou@example.com', 'maryam@example.com', 'jocelyn@example.com', 'hilde@example.com', 'marie@example.com', 'emilie@example.com', 'rachel@example.com', 'mae@example.com', 'florence@example.com', 'stephanie@example.com', 'gladys@example.com', 'shafi@example.com', 'vera@example.com', 'cecilia@example.com', 'edith@example.com', 'lynn@example.com', 'tu@example.com', 'chien@example.com', 'nettie@example.com', 'gerty@example.com', 'mcclintock@example.com', 'elion@example.com', 'rosa@example.com', 'meitner@example.com', 'noether@example.com', 'curie@example.com', 'franklin@example.com', 'hodgkin@example.com', 'kohn@example.com', 'lovelace@example.com', 'easley@example.com', 'keller@example.com', 'granville@example.com', 'hamilton@example.com', 'johnson@example.com', 'goldberg@example.com', 'wu@example.com', 'conway@example.com', 'perey@example.com', 'blackwell@example.com', 'sammet@example.com', 'kovalevskaya@example.com', 'germain@example.com', 'agnesi@example.com', 'somerville@example.com', 'hopper@example.com', 'bartik@example.com', 'payne@example.com', 'clarke@example.com', 'holberton@example.com', 'spence@example.com', 'snyder@example.com', 'teitelbaum@example.com', 'wexler@example.com', 'sinclair@example.com', 'kwolek@example.com', 'jemison@example.com', 'ride@example.com', 'lamarr@example.com', 'mirzakhani@example.com', 'goeppert@example.com', 'tharp@example.com', 'vaughan@example.com', 'leavitt@example.com', 'yalow@example.com', 'widnall@example.com', 'blodgett@example.com', 'rubin@example.com', 'carson@example.com', 'cannon@example.com', 'bassi@example.com', 'herschel@example.com', 'fossey@example.com', 'mitchell@example.com', 'quimby@example.com', 'earle@example.com', 'pickering@example.com', 'tereshkova@example.com', 'lonsdale@example.com', 'avery@example.com', 'bell@example.com', 'sabin@example.com', 'apgar@example.com', 'maathai@example.com', 'montessori@example.com', 'nightingale@example.com', 'sanger@example.com', 'pankhurst@example.com', 'salk@example.com', 'cori@example.com', 'jenner@example.com', 'lister@example.com', 'fleming@example.com', 'pasteur@example.com', 'harvey@example.com', 'snow@example.com', 'semmelweis@example.com', 'koch@example.com', 'mendel@example.com', 'faraday@example.com', 'hooke@example.com'] as const

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
    // A VAPID key pair for tests only (made with web-push's
    // generateVAPIDKeys), so push notifications are on. No push service
    // ever sees it: the tests' subscriptions point at a fake one.
    VAPID_PUBLIC_KEY: TEST_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: 'JNU3GrAgBSIppqVi0CPJWJGluyMLazk2eUdxmB4gSEg',
    VAPID_SUBJECT: 'mailto:push@example.com',
    // The Email Digest and email sign-in are on, sending to a stand-in for
    // Resend (resend-service.ts), never Resend itself. In the browser tests
    // it listens only while a spec that reads the emails runs.
    RESEND_API_KEY: TEST_RESEND_API_KEY,
    RESEND_BASE_URL: `http://127.0.0.1:${RESEND_PORT}`,
  }
}

export const TEST_RESEND_API_KEY = 're_test_email_digest_key'

// Where the stand-in for Resend listens.
export const RESEND_PORT = 3198

export const TEST_VAPID_PUBLIC_KEY = 'BPCfxKRCZj0q7rdmViuJLFJEjxRwx-HMi02GzIogk8vL_vKRTFN59vN5eienDkg3E4IAPZ4mYZLd2RyyL9CUSks'
