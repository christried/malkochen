import { restoreDish, type DishView } from '../../../utils/dishes'

// POST /api/dishes/:id/restore — "Rückgängig" after deleting a Dish: it is
// back in its Column, at the position it had. Restoring one that isn't
// deleted changes nothing.
export default defineEventHandler(async (event): Promise<DishView> => {
  const restored = await restoreDish(dishIdParam(event), requireUser(event).id)
  if (!restored) throw dishNotFound()
  return restored
})
