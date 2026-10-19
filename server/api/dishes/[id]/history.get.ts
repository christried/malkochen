import { dishHistory, type DishHistory } from '../../../utils/dish-history'

// GET /api/dishes/:id/history — the Dish History ("Verlauf") its detail
// shows: when it was added and by whom, its Cookings and its Comments,
// oldest first (server/utils/dish-history.ts).
export default defineEventHandler(async (event): Promise<DishHistory> => {
  const history = await dishHistory(dishIdParam(event), requireUser(event).id)
  if (!history) throw dishNotFound()
  return history
})
