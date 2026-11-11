import type { AdminRecipeFinderUser } from '../../../../shared/recipe-finder'
import { requireOperator } from '../../../utils/operator'
import { recipeFinderUsers } from '../../../utils/recipe-finder'

// GET /api/admin/recipe-finder — everyone who asked for the Recipe Finder or
// has it (#497), for the Operator only: "not found" to anyone else.
export default defineEventHandler((event): Promise<AdminRecipeFinderUser[]> => {
  requireOperator(event)
  return recipeFinderUsers()
})
