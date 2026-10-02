import { restoreDish, type PlacedDish } from '../../../utils/dishes'

// POST /api/dishes/:id/restore — "Rückgängig" after deleting a Dish: it is
// back in its Column, at the position it had, and the answer says where
// that is (PlacedDish). Restoring one that isn't deleted changes nothing.
export default defineEventHandler(async (event): Promise<PlacedDish> => {
  const restored = await restoreDish(dishIdParam(event), requireUser(event).id)
  if (!restored) throw dishNotFound()
  return restored
})
