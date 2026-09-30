import type { Http } from './http'

export type SourceKind
  = | 'tiktok'
    | 'instagram-reel'
    | 'instagram-post'
    | 'youtube-short'
    | 'pinterest-pin'
    | 'blog'
    | 'other'

// What we know about a link. Only `kind` and `canonicalLink` are always
// meaningful; the title may be empty and the image absent.
export interface SourceLookupResult {
  kind: SourceKind
  // The normalised link: the same post or page pasted twice (short link,
  // share parameters, mobile host) gives the same value.
  canonicalLink: string
  suggestedTitle: string
  // A third-party image URL. It may expire, so it is copied into our own
  // storage when a Dish is saved.
  imageUrl: string | null
}

// What a link says about itself before any request.
export type SourceGuess = Pick<SourceLookupResult, 'kind' | 'canonicalLink'>

// The answer when nothing more than the guess could be found.
export function nothingFound(guess: SourceGuess): SourceLookupResult {
  return { ...guess, suggestedTitle: '', imageUrl: null }
}

// Given a link, return what we know about it. Never rejects.
export type SourceLookup = (link: string) => Promise<SourceLookupResult>

export interface StrategyContext {
  http: Http
}

// One per kind of Source. `match` decides from the link alone (no network)
// whether the strategy handles it, and what to answer if the lookup then fails.
export interface Strategy {
  match: (url: URL) => SourceGuess | null
  lookup: (url: URL, context: StrategyContext) => Promise<SourceLookupResult>
}
