import { RECIPE_LIMITS } from '../../shared/recipe'
import type { PageRecipe, RecipeLookup, SourceKind } from '../source-lookup'

// The Recipe Finder (CONTEXT.md, #492, ADR 0013): given a Dish's Source, it
// answers with a Recipe and where it came from, or that there is none, or
// that it failed. How it looks is hidden in here. For now its only step is
// the recipe data the Source's own page carries (Source Lookup); the
// language model and following a link come behind the same interface. No
// database: who may search, the daily cap and what a result does to the Dish
// are server/utils/recipe-search.ts.

// What it is given of a Dish's Source.
export interface RecipeFinderSource {
  link: string
  kind: SourceKind
  caption: string | null
}

export type RecipeFinderResult
  // `link`: the page the Recipe was found at when that isn't the Source
  // itself; null for one found at the Source.
  = | { outcome: 'found', recipe: PageRecipe, link: string | null }
  // The Source holds no Recipe: another search of it would find the same.
    | { outcome: 'none' }
  // The search itself failed (a page didn't answer): another try may not.
    | { outcome: 'failed' }

// Never rejects.
export type RecipeFinder = (source: RecipeFinderSource) => Promise<RecipeFinderResult>

export interface RecipeFinderOptions {
  // Reads the recipe data a link's page carries (createRecipeLookup).
  lookupRecipe: RecipeLookup
}

// A found recipe held to what a Recipe holds (shared/recipe.ts): lines
// trimmed, empty ones dropped, each cut to its length, each list cut to its
// number of lines. Null if nothing is left.
export function withinRecipeLimits(recipe: PageRecipe): PageRecipe | null {
  const held = (lines: string[], limit: { lines: number, characters: number }) => lines
    .map(line => line.trim().slice(0, limit.characters).trim())
    .filter(line => line !== '')
    .slice(0, limit.lines)
  const ingredients = held(recipe.ingredients, RECIPE_LIMITS.ingredients)
  const steps = held(recipe.steps, RECIPE_LIMITS.steps)
  return ingredients.length > 0 || steps.length > 0 ? { ingredients, steps } : null
}

export function createRecipeFinder({ lookupRecipe }: RecipeFinderOptions): RecipeFinder {
  return async (source) => {
    try {
      // Step 1: the recipe data on the Source's own page.
      const page = await lookupRecipe(source.link)
      if (page.outcome === 'unreadable') return { outcome: 'failed' }
      const recipe = page.outcome === 'found' ? withinRecipeLimits(page.recipe) : null
      return recipe ? { outcome: 'found', recipe, link: null } : { outcome: 'none' }
    }
    catch {
      return { outcome: 'failed' }
    }
  }
}
