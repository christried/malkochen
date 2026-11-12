import type { DishView } from '../server/utils/dishes'

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

// Where a Dish stands with the Recipe Finder's search for its Recipe (#500):
// 'looking' while one runs, 'none' once it found nothing for the Dish's
// current Source (it looks again only when the Source changes); null for
// neither.
export type RecipeSearch = 'looking' | 'none'

// What "Rezept finden" ended in: it found a Recipe, found none, or failed
// (the page didn't answer), which another try may change.
export type RecipeSearchOutcome = 'found' | 'none' | 'failed'

// What "Rezept finden" answers (#500): how the search ended and the Dish as
// it is now.
export interface RecipeSearchAnswer {
  outcome: RecipeSearchOutcome
  dish: DishView
}
