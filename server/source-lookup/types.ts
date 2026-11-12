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
  // Whether the Source has a video malkochen's player plays in place (#394): a
  // TikTok video, a YouTube Short, an Instagram post whose embed plays it;
  // false for anything else, and when it can't be told.
  playableVideo: boolean
}

// What a link says about itself before any request.
export type SourceGuess = Pick<SourceLookupResult, 'kind' | 'canonicalLink'>

// The answer when nothing more than the guess could be found.
export function nothingFound(guess: SourceGuess): SourceLookupResult {
  return { ...guess, suggestedTitle: '', creator: null, imageUrl: null, caption: null, playableVideo: false }
}

// Given a link, return what we know about it. Never rejects.
export type SourceLookup = (link: string) => Promise<SourceLookupResult>

// The recipe a page carries as schema.org Recipe data: its ingredient list as
// Ingredients and its instructions as Steps (CONTEXT.md), each plain text the
// way the page wrote it, in the page's order. Either list may be empty, never
// both. Not held to the Recipe's limits (shared/recipe.ts).
export interface PageRecipe {
  ingredients: string[]
  steps: string[]
}

// What reading a link's page for its recipe gave: the recipe, or that the page
// carries none (a kind of Source that never does included), or that the page
// couldn't be read, which another try may change.
export type RecipeLookupResult
  = | { outcome: 'found', recipe: PageRecipe }
    | { outcome: 'none' }
    | { outcome: 'unreadable' }

// Given a link, return the recipe its page carries. Never rejects.
export type RecipeLookup = (link: string) => Promise<RecipeLookupResult>

// A page read for its recipe (#502): the recipe data it carries, else its
// readable text, cut to a fixed size (page-text.ts). `link` is where the page
// was finally served from, without tracking parameters: the link a Recipe
// found there keeps. The text may be empty, for a page with nothing to read.
// Unreadable: the page couldn't be read, or isn't a public one.
export type PageLookupResult
  = | { outcome: 'recipe', link: string, recipe: PageRecipe }
    | { outcome: 'text', link: string, text: string }
    | { outcome: 'unreadable' }

// Given a link, read the page it leads to, whatever the host, in one request.
// Never rejects.
export type PageLookup = (link: string) => Promise<PageLookupResult>

// The page a Source points at as where its recipe is: a Pin's destination.
// Other kinds of Source have none.
export type DestinationLookupResult = { outcome: 'found', link: string } | { outcome: 'none' } | { outcome: 'unreadable' }

// Given a link, return the page its Source says the recipe is at. Never
// rejects.
export type DestinationLookup = (link: string) => Promise<DestinationLookupResult>

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
  // The recipe the link's page carries, for the kinds of Source whose pages
  // carry one.
  recipe?: (url: URL, context: StrategyContext) => Promise<RecipeLookupResult>
  // The page the Source says its recipe is at, for the kinds of Source that
  // say so.
  destination?: (url: URL, context: StrategyContext) => Promise<DestinationLookupResult>
}
