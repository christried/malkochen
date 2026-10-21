import { deleteCooking } from '../../utils/cookings'

// DELETE /api/cookings/:id — deletes one Cooking from a Dish's Cooking
// History. A soft delete: POST /api/cookings/:id/restore undoes it.
export default defineEventHandler(async (event) => {
  const cookingId = cookingIdParam(event)
  const userId = requireUser(event).id
  await requireCookingPermission(cookingId, userId)
  if (!await deleteCooking(cookingId, userId)) throw cookingNotFound()
  setResponseStatus(event, 204)
  return null
})
