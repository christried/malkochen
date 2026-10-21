import { deleteDish } from '../../utils/dishes'

// DELETE /api/dishes/:id — archives a Dish ("Archivieren") from the card's
// "…" menu or its detail. A soft delete: POST /api/dishes/:id/restore
// brings it back, from "Rückgängig" or the Board's Archive.
export default defineEventHandler(async (event) => {
  const dishId = dishIdParam(event)
  const userId = requireUser(event).id
  // Anyone's Dish with "archive Dishes", else only one the user added.
  await requireDishPermission(dishId, userId, 'archiveDishes')
  if (!await deleteDish(dishId, userId)) throw dishNotFound()
  setResponseStatus(event, 204)
  return null
})
