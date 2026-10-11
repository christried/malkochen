// What one user may do of the costly things, per window (security pass
// #139): far above what anyone cooking does, low enough that an account
// gone wrong, or a client stuck in a loop, can't run up the bill. Over the
// limit a call answers 429 until the window is over
// (server/utils/rate-limit.ts). The window is a Postgres interval.
export const RATE_LIMITS = {
  // Up to ~5 outbound requests and 8 s of function time each.
  'source-lookup': { calls: 60, window: '10 minutes' },
  // Own photos and Profile Pictures together: decoding up to 50 MP, and a
  // Blob write.
  'upload': { calls: 30, window: '1 hour' },
  // A Dish from a link copies its image: a download and a Blob write.
  'add-dish': { calls: 200, window: '1 hour' },
  'create-board': { calls: 20, window: '1 day' },
} as const

export type RateLimited = keyof typeof RATE_LIMITS
