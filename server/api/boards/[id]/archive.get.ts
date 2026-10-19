import { archivedDishes, type ArchivedDishView } from '../../../utils/dishes'

// GET /api/boards/:id/archive — the Board's Archive in Board Settings: its
// Archived Dishes, the newest archived first, for any Member.
export default defineEventHandler(async (event): Promise<{ dishes: ArchivedDishView[] }> => {
  const dishes = await archivedDishes(boardIdParam(event), requireUser(event).id)
  if (!dishes) throw boardNotFound()
  return { dishes }
})
