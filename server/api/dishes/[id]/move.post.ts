import { z } from 'zod'
import { isDishMember, moveDish, type MovedDish } from '../../../utils/dishes'

// `index`: where drag and drop put it among the Column's other Dishes.
const body = z.object({ columnId: z.uuid(), index: z.int().min(0).max(100_000).optional() })

// POST /api/dishes/:id/move — "Verschieben nach…": the Dish goes to the top
// of another Column, on its Board or another of the user's Boards; dragged,
// it goes to `index` in any Column. Moved into a Gekocht Column, it records
// a Cooking: the answer's `cooking`. A Column on a Board the user isn't a
// Member of is refused.
export default defineEventHandler(async (event): Promise<MovedDish> => {
  const dishId = dishIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Column' })
  const user = requireUser(event)
  const moved = await moveDish(dishId, user.id, parsed.data.columnId, { index: parsed.data.index })
  if (moved) return moved
  if (await isDishMember(dishId, user.id)) throw createError({ statusCode: 400, statusMessage: 'Column not on one of your Boards' })
  throw dishNotFound()
})
