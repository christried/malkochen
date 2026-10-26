import { shareDish } from '../../../utils/dish-links'

// POST /api/dishes/:id/link — "Link teilen": the path of the Dish's Dish Link
// (/d/<title slug>-<secret>), made the first time and the same after. Any
// Member who can see the Dish may share it, "Nur ansehen" included; an
// Archived Dish, or one on an Archived Board, has no link to share.
export default defineEventHandler(async (event): Promise<{ path: string }> => {
  const path = await shareDish(dishIdParam(event), requireUser(event).id)
  if (!path) throw dishNotFound()
  return { path }
})
