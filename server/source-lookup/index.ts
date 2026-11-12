import { createHttp } from './http'
import { instagram } from './instagram'
import { withoutTracking } from './link'
import { pageText } from './page-text'
import { pinterest } from './pinterest'
import { recipeInPage } from './recipe'
import { tiktok } from './tiktok'
import { webPage } from './web-page'
import { youtube } from './youtube'
import { nothingFound, type DestinationLookup, type PageLookup, type RecipeLookup, type SourceGuess, type SourceLookup, type Strategy } from './types'

export { SOURCE_KINDS } from './types'
export { captionOf } from './caption'
export type { DestinationLookup, DestinationLookupResult, PageLookup, PageLookupResult, PageRecipe, RecipeLookup, RecipeLookupResult, SourceGuess, SourceKind, SourceLookup, SourceLookupResult } from './types'

// Source Lookup: given a link, return what we know about it (Source kind,
// Suggested Title, image, canonical link). The strategy for each kind of
// Source is hidden in here; callers only ever see a SourceLookup, so the whole module
// can be swapped for a paid unfurl service without changes elsewhere.

export interface SourceLookupOptions {
  // Time budget for one lookup, across all its upstream requests.
  timeoutMs?: number
  fetch?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 8000

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
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

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

// The recipe a link's page carries (CONTEXT.md: Recipe Finder), under the
// same time budget and through the same fetching as a lookup. A link whose
// kind of Source never carries one is answered without a request.
export function createRecipeLookup(options: SourceLookupOptions = {}): RecipeLookup {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return async (link) => {
    const { url, strategy } = matchStrategy(link)
    if (!url || !strategy.recipe) return { outcome: 'none' }

    const http = createHttp(AbortSignal.timeout(timeoutMs), options.fetch)
    try {
      return await strategy.recipe(url, { http, timeoutMs })
    }
    catch {
      return { outcome: 'unreadable' }
    }
  }
}

// The page a link leads to, read for its recipe (#502): the recipe data it
// carries, else its readable text. Always read as a web page, whatever the
// host: the page is one a post pointed to, in a Caption or as its
// destination. One request, under the same time budget and through the same
// fetching as a lookup, which refuses a page that isn't public.
export function createPageLookup(options: SourceLookupOptions = {}): PageLookup {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return async (link) => {
    const http = createHttp(AbortSignal.timeout(timeoutMs), options.fetch)
    try {
      const page = await http.page(link.trim())
      if (page.html === null) return { outcome: 'unreadable' }
      const served = withoutTracking(new URL(page.url))
      const recipe = recipeInPage(page.html)
      return recipe ? { outcome: 'recipe', link: served, recipe } : { outcome: 'text', link: served, text: pageText(page.html) }
    }
    catch {
      return { outcome: 'unreadable' }
    }
  }
}

// The page a link's Source says its recipe is at (#502): for a Pin, the
// destination it leads to. A link whose kind of Source has none is answered
// without a request. Under the same time budget and through the same fetching
// as a lookup.
export function createDestinationLookup(options: SourceLookupOptions = {}): DestinationLookup {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return async (link) => {
    const { url, strategy } = matchStrategy(link)
    if (!url || !strategy.destination) return { outcome: 'none' }

    const http = createHttp(AbortSignal.timeout(timeoutMs), options.fetch)
    try {
      return await strategy.destination(url, { http, timeoutMs })
    }
    catch {
      return { outcome: 'unreadable' }
    }
  }
}
