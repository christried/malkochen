import { createHttp } from './http'
import { instagram, playsInPlace } from './instagram'
import { pinterest } from './pinterest'
import { tiktok } from './tiktok'
import { webPage } from './web-page'
import { youtube } from './youtube'
import { nothingFound, type SourceGuess, type SourceLookup, type Strategy } from './types'

export { SOURCE_KINDS } from './types'
export type { SourceGuess, SourceKind, SourceLookup, SourceLookupResult } from './types'

// Source Lookup: given a link, return what we know about it (Source kind,
// Suggested Title, image, canonical link). The strategy for each kind of
// Source is hidden in here; callers only ever see a SourceLookup, so the whole module
// can be swapped for a paid unfurl service without changes elsewhere.

export interface SourceLookupOptions {
  // Time budget for one lookup, across all its upstream requests.
  timeoutMs?: number
  fetch?: typeof fetch
}

// The first whose `match` answers handles the link; webPage takes the rest.
const STRATEGIES: Strategy[] = [tiktok, instagram, youtube, pinterest, webPage]

// What a link says about itself, without any request: its Source kind and
// canonical link. Used when a Dish is saved, so the stored Source never
// depends on what the client claims.
export function guessSource(link: string): SourceGuess {
  return matchStrategy(link).guess
}

function matchStrategy(link: string): { url: URL | null, strategy: Strategy, guess: SourceGuess } {
  const fallback = { kind: 'other', canonicalLink: link.trim() } as const
  let url: URL
  try {
    url = new URL(link.trim())
  }
  catch {
    return { url: null, strategy: webPage, guess: fallback }
  }
  for (const strategy of STRATEGIES) {
    const guess = strategy.match(url)
    if (guess) return { url, strategy, guess }
  }
  return { url, strategy: webPage, guess: fallback }
}

export function createSourceLookup(options: SourceLookupOptions = {}): SourceLookup {
  const timeoutMs = options.timeoutMs ?? 8000

  return async (link) => {
    const { url, strategy, guess } = matchStrategy(link)
    if (!url) return nothingFound(guess)

    const http = createHttp(AbortSignal.timeout(timeoutMs), options.fetch)
    try {
      return await strategy.lookup(url, { http, timeoutMs })
    }
    catch {
      return nothingFound(guess)
    }
  }
}

// Whether Instagram's embed plays an Instagram post's video in place (#279):
// false for one it only shows with "Auf Instagram ansehen"; null when that
// isn't known. Asked when a Dish detail opens, not when a Dish is added:
// Instagram can change its mind about a post.
export type InstagramPlayCheck = (link: string) => Promise<boolean | null>

export function createInstagramPlayCheck(options: SourceLookupOptions = {}): InstagramPlayCheck {
  const timeoutMs = options.timeoutMs ?? 3000

  return async (link) => {
    try {
      return await playsInPlace(createHttp(AbortSignal.timeout(timeoutMs), options.fetch), link)
    }
    catch {
      return null
    }
  }
}
