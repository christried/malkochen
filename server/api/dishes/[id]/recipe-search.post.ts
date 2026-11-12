import { membersDish } from '../../../utils/dishes'
import { finishRecipeSearch, startRecipeSearch, type RecipeSearchAnswer } from '../../../utils/recipe-search'

// POST /api/dishes/:id/recipe-search: "Rezept finden" (#500). The Recipe
// Finder looks for the Dish's Recipe and answers how the search ended
// (`outcome`: 'found', 'none' or 'failed') with the Dish as it is now.
// Only a user whose Recipe Finder is on may search, and only a Dish they may
// edit: anyone's with "edit Dishes", else one they added (403, `data.reason`
// 'recipe-finder-off' for the switch); a Dish they can't see is "not found"
// (404), as is an archived one. The Dish must have a Source and no Recipe
// yet, and not be searched without result for its current Source already, nor
// be searched right now (409, `data.reason` 'no-source', 'has-recipe',
// 'nothing-found' or 'looking'). The daily cap answers 429 (`data.reason`
// 'daily-limit'). A failed search is free and can be repeated. A Recipe typed
// by a Member meanwhile is kept, whatever the search found.
export default defineEventHandler(async (event): Promise<RecipeSearchAnswer> => {
  const dishId = dishIdParam(event)
  const user = requireUser(event)
  const source = await startRecipeSearch(dishId, user.id)
  const outcome = await finishRecipeSearch(dishId, user.id, source)
  const found = await membersDish(dishId, user.id)
  if (!found) throw dishNotFound()
  return { outcome, dish: found }
})
