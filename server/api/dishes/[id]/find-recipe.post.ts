import type { RecipeSearchAnswer } from '../../../../shared/recipe'
import { findRecipeFor } from '../../../utils/recipe-search'

// POST /api/dishes/:id/find-recipe — "Rezept finden" (#500): the Recipe
// Finder looks for the Recipe of a Dish that has a Source and no Recipe yet.
// Answers how the search ended (`found`, `none`, or `failed` when the page
// didn't answer, which another try may change) and the Dish as it is then. A
// Recipe is only written into a Dish that still has none. 403 unless the
// Recipe Finder is on for the user and they may edit the Dish; 409 for a Dish
// without a Source, with a Recipe, with nothing found for its Source or being
// looked at already; 429 after the day's 30 searches.
export default defineEventHandler((event): Promise<RecipeSearchAnswer> => {
  return findRecipeFor(dishIdParam(event), requireUser(event).id)
})
