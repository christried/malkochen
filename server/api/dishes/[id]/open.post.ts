import { dishHistory, type DishHistory } from '../../../utils/dish-history'
import { markDishOpened } from '../../../utils/dish-opened'

// POST /api/dishes/:id/open — the Dish detail calls this as it opens:
// records that the user opened the Dish, which clears its card's mark for
// what's new in its Dish History (#335), then answers that Dish History
// ("Verlauf"): when it was added and by whom, its Cookings, Votes and
// Comments, oldest first (server/utils/dish-history.ts). Recording first:
// anything added in between still marks the card next time, never the
// other way round.
export default defineEventHandler(async (event): Promise<DishHistory> => {
  const dishId = dishIdParam(event)
  const userId = requireUser(event).id
  if (!await markDishOpened(dishId, userId)) throw dishNotFound()
  const history = await dishHistory(dishId, userId)
  if (!history) throw dishNotFound()
  return history
})
