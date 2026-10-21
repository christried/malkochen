import { restoreCooking, type CookingView } from '../../../utils/cookings'

// POST /api/cookings/:id/restore — "Rückgängig" after deleting a Cooking: it
// is back in the Cooking History. Restoring one that isn't deleted changes nothing.
export default defineEventHandler(async (event): Promise<CookingView> => {
  const cookingId = cookingIdParam(event)
  const userId = requireUser(event).id
  await requireCookingPermission(cookingId, userId)
  const restored = await restoreCooking(cookingId, userId)
  if (!restored) throw cookingNotFound()
  return restored
})
