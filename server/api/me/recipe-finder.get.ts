import type { RecipeFinderState } from '../../../shared/recipe-finder'
import { recipeFinderStateOf } from '../../utils/recipe-finder'

// GET /api/me/recipe-finder — the user's Recipe Finder state (#497): off,
// asked (with when) or on.
export default defineEventHandler((event): Promise<RecipeFinderState> => {
  return recipeFinderStateOf(requireUser(event).id)
})
