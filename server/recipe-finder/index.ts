import { RECIPE_LIMITS } from '../../shared/recipe'
import type { DestinationLookup, PageLookup, RecipeLookup, SourceKind } from '../source-lookup'
import type { RecipeReader } from './model'

// The Recipe Finder (CONTEXT.md, ADR 0013): given a Dish's Source, the
// Recipe it carries and where it was found, or that there is none, or that
// the search failed. How it looks is hidden in here (the recipe data of the
// Source's page, then the Caption read by a model, then one page the Source
// or the Caption points to), so callers only ever see a RecipeFinder. It
// knows nothing of Dishes, the database or who may search.

// What the Recipe Finder looks at: the Source's link and kind, and the
// Caption (CONTEXT.md) the Dish holds, if any.
export interface RecipeSource {
  link: string
  kind: SourceKind
  caption: string | null
}

// The lines of a Recipe (CONTEXT.md: Ingredient, Step), as a Dish keeps them.
export interface RecipeLines {
  ingredients: string[]
  steps: string[]
}

export type RecipeFinderResult
  // `link`: the page it was found at when that isn't the Source itself (a page
  // the Source or its Caption pointed to); null for a Recipe of the Source's
  // own page or of its Caption.
  = | { outcome: 'found', recipe: RecipeLines, link: string | null }
    | { outcome: 'none' }
  // The search itself failed (the page or the model didn't answer): another
  // try may find something.
    | { outcome: 'failed' }

// Given a Source, look for its Recipe. Never rejects.
export type RecipeFinder = (source: RecipeSource) => Promise<RecipeFinderResult>

function limited(lines: string[], { lines: most, characters }: { lines: number, characters: number }): string[] {
  return lines.map(line => line.trim()).filter(line => line !== '').slice(0, most).map(line => line.slice(0, characters))
}

// Lines found on a page or by a model, held to a Recipe's limits
// (RECIPE_LIMITS) the way a Member's are, except that they are cut to fit
// instead of refused: trimmed, the empty ones dropped, each list to its line
// limit and each line to its character limit.
export function heldToLimits({ ingredients, steps }: RecipeLines): RecipeLines {
  return { ingredients: limited(ingredients, RECIPE_LIMITS.ingredients), steps: limited(steps, RECIPE_LIMITS.steps) }
}

// Lines held to the limits, or null when nothing is left of them.
function recipeOf(lines: RecipeLines): RecipeLines | null {
  const recipe = heldToLimits(lines)
  return recipe.ingredients.length > 0 || recipe.steps.length > 0 ? recipe : null
}

// The link the model named in a Caption, if it is one the Caption really
// holds: the trimmed `named` must be non-empty, at most 2048 characters and
// occur in the Caption as written, so a link the model made up, changed or
// completed from a name is never followed. Then it gets `https://` if it has
// no scheme and must be an http(s) link with a host that has a dot and no
// user name or password; answered as the URL it is, else null. That the host
// is a public one is the page lookup's to check, not this function's.
export function linkInCaption(named: string, caption: string): string | null {
  const link = named.trim()
  if (link === '' || link.length > 2048 || !caption.includes(link)) return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(link) ? link : `https://${link}`)
    const web = url.protocol === 'https:' || url.protocol === 'http:'
    return web && url.hostname.includes('.') && !url.username && !url.password ? url.href : null
  }
  catch {
    return null
  }
}

function sameLink(a: string, b: string): boolean {
  try {
    return new URL(a).href === new URL(b).href
  }
  catch {
    return a === b
  }
}

interface RecipeFinderDependencies {
  lookupRecipe: RecipeLookup
  // Reads a Caption or a page's text; null without an API key, when the Recipe
  // Finder does nothing at all.
  readRecipe: RecipeReader | null
  lookupPage: PageLookup
  lookupDestination: DestinationLookup
}

// The Recipe Finder's steps, in order, stopping at the first Recipe:
//   1. the recipe data of the Source's page;
//   2. the Caption, read by the model (`readRecipe`);
//   3. one page to follow: a Pin's destination, else the link the model named
//      in the Caption (checked by linkInCaption). Its recipe data, else its
//      text read by the model. The page's link is the Recipe's.
// A search follows at most one page and asks the model at most twice, by how
// it is built: a link on the followed page, or one the model names when
// reading it, is never followed.
// When nothing was found, the search failed if any step failed (a page
// couldn't be read, or the model didn't answer): another try may find
// something. Else there is none.
export function createRecipeFinder({ lookupRecipe, readRecipe, lookupPage, lookupDestination }: RecipeFinderDependencies): RecipeFinder {
  return async (source) => {
    let failed = false

    try {
      const looked = await lookupRecipe(source.link)
      if (looked.outcome === 'unreadable') failed = true
      if (looked.outcome === 'found') {
        const recipe = recipeOf(looked.recipe)
        if (recipe) return { outcome: 'found', recipe, link: null }
      }
    }
    catch {
      failed = true
    }

    // The link the model named in the Caption, for step 3.
    let named: string | null = null
    const caption = source.caption?.trim()
    if (caption && readRecipe) {
      try {
        const read = await readRecipe({ from: 'caption', text: caption })
        if (read.outcome === 'failed') failed = true
        else {
          const recipe = recipeOf(read)
          if (recipe) return { outcome: 'found', recipe, link: null }
          named = read.link && linkInCaption(read.link, caption)
        }
      }
      catch {
        failed = true
      }
    }

    // A Pin says where its recipe is; failing that, the Caption may.
    let follow: string | null = null
    if (source.kind === 'pinterest-pin') {
      try {
        const destination = await lookupDestination(source.link)
        if (destination.outcome === 'found') follow = destination.link
        if (destination.outcome === 'unreadable') failed = true
      }
      catch {
        failed = true
      }
    }
    follow ??= named
    if (follow && !sameLink(follow, source.link)) {
      try {
        const page = await lookupPage(follow)
        if (page.outcome === 'unreadable') failed = true
        if (page.outcome === 'recipe') {
          const recipe = recipeOf(page.recipe)
          if (recipe) return { outcome: 'found', recipe, link: page.link }
        }
        if (page.outcome === 'text' && page.text !== '' && readRecipe) {
          const read = await readRecipe({ from: 'page', text: page.text })
          if (read.outcome === 'failed') failed = true
          else {
            const recipe = recipeOf(read)
            if (recipe) return { outcome: 'found', recipe, link: page.link }
          }
        }
      }
      catch {
        failed = true
      }
    }

    return { outcome: failed ? 'failed' : 'none' }
  }
}
