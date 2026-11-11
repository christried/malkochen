import type { RecipeFinderState } from '../../../shared/recipe-finder'
import { askForRecipeFinder } from '../../utils/recipe-finder'

// POST /api/me/recipe-finder — "Zugang anfragen" (#497): asks the Operator
// for the Recipe Finder, which emails them once. Asked or on already:
// nothing changes. Answers the state after. Switching it on is the
// Operator's alone (/api/admin/recipe-finder).
export default defineEventHandler((event): Promise<RecipeFinderState> => {
  return askForRecipeFinder(requireUser(event))
})
