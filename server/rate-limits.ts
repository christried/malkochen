// What one user may do of the costly things, per window (security pass
// #139): far above what anyone cooking does, low enough that an account
// gone wrong, or a client stuck in a loop, can't run up the bill. Over the
// limit a call answers 429 until the window is over
// (server/utils/rate-limit.ts). The window is a Postgres interval.
export const RATE_LIMITS = {
  // Up to ~5 outbound requests and 8 s of function time each.
  'source-lookup': { calls: 60, window: '10 minutes' },
  // An Instagram Dish's detail opened (#279): one request to Instagram,
  // fewer when the answer is kept.
  'instagram-plays': { calls: 120, window: '10 minutes' },
  // Own Photos and Profile Pictures together: decoding up to 50 MP, and a
  // Blob write. Per day, not per hour (#347): Vercel Blob's free tier
  // allows 2,000 uploads a month for everything together
  // (docs/research/free-tiers.md), so one user can use at most 600 of them.
  'upload': { calls: 20, window: '1 day' },
  // A Dish from a link copies its image: a download and a Blob write. So
  // does "Bild neu laden" on a Dish, which counts here too.
  'add-dish': { calls: 200, window: '1 hour' },
  'create-board': { calls: 20, window: '1 day' },
  // Changing your Username (#209). Not costly: so a name others know
  // someone by doesn't keep changing, and names can't be tried out in bulk.
  'username': { calls: 10, window: '1 day' },
} as const

export type RateLimited = keyof typeof RATE_LIMITS

// What one IP address (or one email address) may do of what needs no
// session, per window. What happens over the limit is each caller's to decide
// (server/utils/rate-limit.ts).
export const CLIENT_RATE_LIMITS = {
  // A page that breaks its policy does so a handful of times per load; more
  // than this is someone filling the log (server/api/csp-report.post.ts).
  'csp-report': { calls: 60, window: '10 minutes' },
  // Sign-in codes by email (#347), so nobody can spam an inbox or use up
  // Resend's free 100 emails a day (docs/research/free-tiers.md). Per address
  // the code goes to (asking again, a mistyped address fixed), and per IP
  // address (a household signing in together). Refused with when another can
  // be asked for (server/utils/auth.ts).
  'sign-in-codes-per-address': { calls: 5, window: '1 hour' },
  'sign-in-codes-per-ip': { calls: 10, window: '1 hour' },
} as const

export type ClientRateLimited = keyof typeof CLIENT_RATE_LIMITS
