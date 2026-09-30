import { createHttp } from './http'
import { instagram } from './instagram'
import { pinterest } from './pinterest'
import { tiktok } from './tiktok'
import { webPage } from './web-page'
import { youtube } from './youtube'
import { nothingFound, type SourceGuess, type SourceLookup, type Strategy } from './types'

export type { SourceKind, SourceLookup, SourceLookupResult } from './types'

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

export function createSourceLookup(options: SourceLookupOptions = {}): SourceLookup {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 8000

  return async (link) => {
    let url: URL
    try {
      url = new URL(link.trim())
    }
    catch {
      return nothingFound({ kind: 'other', canonicalLink: link.trim() })
    }

    let strategy = webPage
    let guess: SourceGuess = { kind: 'other', canonicalLink: link.trim() }
    for (const candidate of STRATEGIES) {
      const match = candidate.match(url)
      if (match) {
        [strategy, guess] = [candidate, match]
        break
      }
    }

    const http = createHttp(fetchImpl, AbortSignal.timeout(timeoutMs))
    try {
      return await strategy.lookup(url, { http })
    }
    catch {
      return nothingFound(guess)
    }
  }
}
