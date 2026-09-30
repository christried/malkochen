import { deleteDish } from '../../utils/dishes'

// DELETE /api/dishes/:id — deletes a Dish from the card's "…" menu or its
// detail. A soft delete: POST /api/dishes/:id/restore undoes it.
export default defineEventHandler(async (event) => {
  const dishId = dishIdParam(event)
  if (!await deleteDish(dishId, requireUser(event).id)) throw dishNotFound()
  setResponseStatus(event, 204)
  return null
})
