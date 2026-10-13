// What one user may do of the costly things, per window (security pass
// #139): far above what anyone cooking does, low enough that an account
// gone wrong, or a client stuck in a loop, can't run up the bill. Over the
// limit a call answers 429 until the window is over
// (server/utils/rate-limit.ts). The window is a Postgres interval.
export const RATE_LIMITS = {
  // Up to ~5 outbound requests and 8 s of function time each.
  'source-lookup': { calls: 60, window: '10 minutes' },
  // Own Photos and Profile Pictures together: decoding up to 50 MP, and a
  // Blob write.
  'upload': { calls: 30, window: '1 hour' },
  // A Dish from a link copies its image: a download and a Blob write. So
  // does "Bild neu laden" on a Dish, which counts here too.
  'add-dish': { calls: 200, window: '1 hour' },
  'create-board': { calls: 20, window: '1 day' },
  // Changing your Username (#209). Not costly: so a name others know
  // someone by doesn't keep changing, and names can't be tried out in bulk.
  'username': { calls: 10, window: '1 day' },
} as const

export type RateLimited = keyof typeof RATE_LIMITS

// What one IP address may do of what needs no session, per window. Over the
// limit a call is dropped without a word (server/utils/rate-limit.ts).
export const CLIENT_RATE_LIMITS = {
  // A page that breaks its policy does so a handful of times per load; more
  // than this is someone filling the log (server/api/csp-report.post.ts).
  'csp-report': { calls: 60, window: '10 minutes' },
} as const

export type ClientRateLimited = keyof typeof CLIENT_RATE_LIMITS
