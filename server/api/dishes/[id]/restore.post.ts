import { restoreDish, type PlacedDish } from '../../../utils/dishes'

// POST /api/dishes/:id/restore — "Rückgängig" after archiving a Dish, or
// "Wiederherstellen" in the Board's Archive: it is back in its Column, at
// the position it had (at the top of the Column that takes new Dishes if
// its Column is gone), and the answer says where that is (PlacedDish).
// Restoring one that isn't archived changes nothing.
export default defineEventHandler(async (event): Promise<PlacedDish> => {
  const restored = await restoreDish(dishIdParam(event), requireUser(event).id)
  if (!restored) throw dishNotFound()
  return restored
})
