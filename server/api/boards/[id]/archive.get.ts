import { isMember } from '../../../utils/boards'
import { archivedDishes, type ArchivedDishView } from '../../../utils/dishes'

// GET /api/boards/:id/archive — the Board's Archive in Board Settings: its
// Archived Dishes, the newest archived first, for any Member.
export default defineEventHandler(async (event): Promise<{ dishes: ArchivedDishView[] }> => {
  const boardId = boardIdParam(event)
  if (!await isMember(boardId, requireUser(event).id)) throw boardNotFound()
  return { dishes: await archivedDishes(boardId) }
})
