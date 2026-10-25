import type { Http } from './http'

export const SOURCE_KINDS = [
  'tiktok',
  'instagram-reel',
  'instagram-post',
  'youtube-short',
  'pinterest-pin',
  'blog',
  'other',
] as const

export type SourceKind = typeof SOURCE_KINDS[number]

// What we know about a link. Only `kind` and `canonicalLink` are always
// meaningful; the title may be empty and the image absent.
export interface SourceLookupResult {
  kind: SourceKind
  // The normalised link: the same post or page pasted twice (short link,
  // share parameters, mobile host) gives the same value.
  canonicalLink: string
  suggestedTitle: string
  // The Creator (CONTEXT.md): the account, channel or blog that published
  // the Source, as it names itself; null when it names none.
  creator: string | null
  // A third-party image URL. It may expire, so it is copied into our own
  // storage when a Dish is saved.
  imageUrl: string | null
  // The Caption (CONTEXT.md): the text the Source shows with its post; null
  // when it shows none, or none could be read.
  caption: string | null
}

// What a link says about itself before any request.
export type SourceGuess = Pick<SourceLookupResult, 'kind' | 'canonicalLink'>

// The answer when nothing more than the guess could be found.
export function nothingFound(guess: SourceGuess): SourceLookupResult {
  return { ...guess, suggestedTitle: '', creator: null, imageUrl: null, caption: null }
}

// Given a link, return what we know about it. Never rejects.
export type SourceLookup = (link: string) => Promise<SourceLookupResult>

interface StrategyContext {
  http: Http
  // The time budget for the whole lookup, shared by all of `http`'s requests.
  timeoutMs: number
}

// One per kind of Source. `match` decides from the link alone (no network)
// whether the strategy handles it, and what to answer if the lookup then fails.
export interface Strategy {
  match: (url: URL) => SourceGuess | null
  lookup: (url: URL, context: StrategyContext) => Promise<SourceLookupResult>
}
