import type { RecipeFinderStatus } from '../../../shared/recipe-finder'
import { recipeFinderStateOf } from '../../utils/recipe-finder'
import { recipeFinderAvailable } from '../../utils/recipe-search'

// GET /api/me/recipe-finder — the user's Recipe Finder state (#497): off,
// asked (with when) or on, and whether the server can search at all
// (`available`, #501): not without an Anthropic API key.
export default defineEventHandler(async (event): Promise<RecipeFinderStatus> => {
  return { ...await recipeFinderStateOf(requireUser(event).id), available: recipeFinderAvailable }
})
