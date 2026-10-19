import { deleteDish } from '../../utils/dishes'

// DELETE /api/dishes/:id — archives a Dish ("Archivieren") from the card's
// "…" menu or its detail. A soft delete: POST /api/dishes/:id/restore
// brings it back, from "Rückgängig" or the Board's Archive.
export default defineEventHandler(async (event) => {
  const dishId = dishIdParam(event)
  if (!await deleteDish(dishId, requireUser(event).id)) throw dishNotFound()
  setResponseStatus(event, 204)
  return null
})
