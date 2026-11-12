import { RECIPE_LIMITS } from '../../shared/recipe'
import type { RecipeLookup, SourceKind } from '../source-lookup'

// The Recipe Finder (CONTEXT.md, ADR 0013): given a Dish's Source, the
// Recipe it carries and where it was found, or that there is none, or that
// the search failed. How it looks is hidden in here (for now only the recipe
// data of the Source's page; the Caption and a followed link come behind the
// same interface, #501 and #502), so callers only ever see a RecipeFinder.
// It knows nothing of Dishes, the database or who may search.

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
  // `link`: the page it was found at when that isn't the Source itself; null
  // for now, since only the Source's own page is read.
  = | { outcome: 'found', recipe: RecipeLines, link: string | null }
    | { outcome: 'none' }
  // The search itself failed (the page didn't answer): another try may find
  // something.
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

export function createRecipeFinder({ lookupRecipe }: { lookupRecipe: RecipeLookup }): RecipeFinder {
  return async (source) => {
    try {
      const looked = await lookupRecipe(source.link)
      if (looked.outcome === 'unreadable') return { outcome: 'failed' }
      if (looked.outcome === 'none') return { outcome: 'none' }
      const recipe = heldToLimits(looked.recipe)
      return recipe.ingredients.length > 0 || recipe.steps.length > 0 ? { outcome: 'found', recipe, link: null } : { outcome: 'none' }
    }
    catch {
      return { outcome: 'failed' }
    }
  }
}
