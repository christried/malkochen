import { RECIPE_LIMITS } from '../../shared/recipe'
import type { RecipeLookup, SourceKind } from '../source-lookup'
import type { RecipeReader } from './model'

// The Recipe Finder (CONTEXT.md, ADR 0013): given a Dish's Source, the
// Recipe it carries and where it was found, or that there is none, or that
// the search failed. How it looks is hidden in here (the recipe data of the
// Source's page, then the Caption read by a model; a followed link comes
// behind the same interface, #502), so callers only ever see a
// RecipeFinder. It knows nothing of Dishes, the database or who may search.

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
  // for now, since only the Source's own page and Caption are read.
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

// The Recipe Finder's steps, in order, stopping at the first Recipe:
//   1. the recipe data of the Source's page;
//   2. the Caption, read by the model (`readRecipe`; null without an API
//      key, when the Recipe Finder does nothing at all).
// When nothing was found, the search failed if any step failed (the page
// couldn't be read, or the model didn't answer): another try may find
// something. Else there is none.
export function createRecipeFinder({ lookupRecipe, readRecipe }: { lookupRecipe: RecipeLookup, readRecipe: RecipeReader | null }): RecipeFinder {
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

    const caption = source.caption?.trim()
    if (caption && readRecipe) {
      try {
        const read = await readRecipe(caption)
        if (read.outcome === 'failed') failed = true
        else {
          const recipe = recipeOf(read)
          if (recipe) return { outcome: 'found', recipe, link: null }
        }
      }
      catch {
        failed = true
      }
    }

    return { outcome: failed ? 'failed' : 'none' }
  }
}
