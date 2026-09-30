import { z } from 'zod'
import { isDishMember, moveDish, type DishView } from '../../../utils/dishes'

const body = z.object({ columnId: z.uuid() })

// POST /api/dishes/:id/move — "Verschieben nach…": the Dish goes to the top
// of another Column on its Board. A Column anywhere else is refused.
export default defineEventHandler(async (event): Promise<DishView> => {
  const dishId = dishIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Column' })
  const user = requireUser(event)
  const moved = await moveDish(dishId, user.id, parsed.data.columnId)
  if (moved) return moved
  if (await isDishMember(dishId, user.id)) throw createError({ statusCode: 400, statusMessage: 'Column is not on the Dish’s Board' })
  throw dishNotFound()
})
