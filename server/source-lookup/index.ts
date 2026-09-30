import { createHttp } from './http'
import { withoutTracking } from './link'
import { instagram } from './instagram'
import { pinterest } from './pinterest'
import { tiktok } from './tiktok'
import { webPage } from './web-page'
import { youtube } from './youtube'
import type { SourceLookup, SourceLookupResult, Strategy } from './types'

export type { SourceKind, SourceLookup, SourceLookupResult } from './types'

// Source Lookup: given a link, return what we know about it (Source kind,
// Suggested Title, image, canonical link). Every per-platform strategy is
// hidden in here; callers only ever see a SourceLookup, so the whole module
// can be swapped for a paid unfurl service without changes elsewhere.

export interface SourceLookupOptions {
  // Meta app access token (`<app id>|<app secret>`) for Instagram oEmbed.
  // Without it Instagram links give no title and no image.
  instagramAccessToken?: string
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
      return { kind: 'other', canonicalLink: link.trim(), suggestedTitle: '', imageUrl: null }
    }

    const [strategy, guess] = STRATEGIES
      .map(s => [s, s.match(url)] as const)
      .find(([, match]) => match) ?? [webPage, webPage.match(url)]
    const fallback: SourceLookupResult = {
      ...(guess ?? { kind: 'other', canonicalLink: withoutTracking(url) }),
      suggestedTitle: '',
      imageUrl: null,
    }

    const http = createHttp(fetchImpl, AbortSignal.timeout(timeoutMs))
    try {
      return await strategy.lookup(url, { http, instagramAccessToken: options.instagramAccessToken })
    }
    catch {
      return fallback
    }
  }
}
