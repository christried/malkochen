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
  // A third-party image URL. It may expire; the Image Store copies it when a
  // Dish is saved.
  imageUrl: string | null
}

// Given a link, return what we know about it. Never rejects.
export type SourceLookup = (link: string) => Promise<SourceLookupResult>

export interface StrategyContext {
  http: Http
  instagramAccessToken?: string
}

// One per platform. `match` decides from the link alone (no network) whether
// the strategy handles it, and what to answer if the lookup then fails.
export interface Strategy {
  match: (url: URL) => Pick<SourceLookupResult, 'kind' | 'canonicalLink'> | null
  lookup: (url: URL, context: StrategyContext) => Promise<SourceLookupResult>
}
