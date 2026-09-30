import { restoreCooking, type CookingView } from '../../../utils/cookings'

// POST /api/cookings/:id/restore — "Rückgängig" after deleting a Cooking: it
// is back in the Cooking History. Restoring one that isn't deleted changes nothing.
export default defineEventHandler(async (event): Promise<CookingView> => {
  const restored = await restoreCooking(cookingIdParam(event), requireUser(event).id)
  if (!restored) throw cookingNotFound()
  return restored
})
