import { cookDish, type MovedDish } from '../../../utils/dishes'

// POST /api/dishes/:id/cook — the "Gekocht ✓" quick action: records a
// Cooking and moves the Dish to the top of its Board's Gekocht Column (one
// already there stays put). The answer's `cooking` is the one recorded.
export default defineEventHandler(async (event): Promise<MovedDish> => {
  const dishId = dishIdParam(event)
  const userId = requireUser(event).id
  // Into the Gekocht Column: a move, the user's own Dish too.
  await requireDishPermission(dishId, userId, 'moveDishes')
  const cooked = await cookDish(dishId, userId)
  if (!cooked) throw dishNotFound()
  return cooked
})
