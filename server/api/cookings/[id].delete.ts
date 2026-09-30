import { deleteCooking } from '../../utils/cookings'

// DELETE /api/cookings/:id — deletes one Cooking from a Dish's Cooking
// History. A soft delete: POST /api/cookings/:id/restore undoes it.
export default defineEventHandler(async (event) => {
  if (!await deleteCooking(cookingIdParam(event), requireUser(event).id)) throw cookingNotFound()
  setResponseStatus(event, 204)
  return null
})
