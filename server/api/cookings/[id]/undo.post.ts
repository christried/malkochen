import { z } from 'zod'
import { cookingDishId } from '../../../utils/cookings'
import { undoCooking, type DishView } from '../../../utils/dishes'

// Where the Dish was before it was cooked: its Column, and its place among
// that Column's other Dishes.
const body = z.object({ columnId: z.uuid(), index: z.int().min(0).max(100_000) })

// POST /api/cookings/:id/undo — "Rückgängig" in the Gekocht toast: the
// Cooking is removed for good and the Dish goes back where it was.
export default defineEventHandler(async (event): Promise<DishView> => {
  const cookingId = cookingIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid place' })
  const user = requireUser(event)
  const dishId = await cookingDishId(cookingId, user.id)
  if (!dishId) throw cookingNotFound()
  const undone = await undoCooking(cookingId, dishId, user.id, parsed.data.columnId, parsed.data.index)
  if (!undone) throw createError({ statusCode: 400, statusMessage: 'Column not on this Board' })
  return undone
})
