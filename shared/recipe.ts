// A Dish's Recipe (CONTEXT.md: Recipe, Ingredient, Step): what goes in and
// how it's made, each a plain line of text, in the order they are read.
export interface Recipe {
  ingredients: string[]
  steps: string[]
  // The link the Recipe was found at when that isn't the Source itself
  // (CONTEXT.md: Recipe Finder); null for one a Member typed.
  link: string | null
}

// How much a Recipe holds: so many lines, each up to so many characters.
export const RECIPE_LIMITS = {
  ingredients: { lines: 60, characters: 200 },
  steps: { lines: 40, characters: 1000 },
} as const

// Where the Recipe Finder (CONTEXT.md) stands on a Dish: 'looking' while a
// search runs; 'none' once nothing was found for its current Source, so it
// isn't searched again until the Source changes.
export type RecipeSearchState = 'looking' | 'none'
