import type { RecipeFinderStatus } from '../../../shared/recipe-finder'
import { askForRecipeFinder } from '../../utils/recipe-finder'
import { recipeFinderAvailable } from '../../utils/recipe-search'

// POST /api/me/recipe-finder — "Zugang anfragen" (#497): asks the Operator
// for the Recipe Finder, which emails them once. Asked or on already:
// nothing changes. Answers the state after, like the GET does (#501). Switching
// it on is the Operator's alone (/api/admin/recipe-finder).
export default defineEventHandler(async (event): Promise<RecipeFinderStatus> => {
  return { ...await askForRecipeFinder(requireUser(event)), available: recipeFinderAvailable }
})
