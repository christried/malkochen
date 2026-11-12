import { z } from 'zod'
import { movePlannedDish, plannedDishBoard, type PlannedDishView } from '../../utils/week-plan'

const body = z.object({
  day: z.iso.date(),
  index: z.int().min(0).max(100_000).optional(),
})

// PATCH /api/planned-dishes/:id — moves a Planned Dish to a day, at `index`
// among that day's other Planned Dishes or at its end (also within its own
// day: that reorders it), and answers it. Needs the Permission to move
// Dishes. Missing, on a Board the user can't see, or its Dish archived: 404.
export default defineEventHandler(async (event): Promise<PlannedDishView> => {
  const id = plannedDishIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A day is required' })
  const user = requireUser(event)
  const found = await plannedDishBoard(id)
  if (!found) throw plannedDishNotFound()
  await requirePermission(found.boardId, user.id, 'moveDishes')
  const moved = await movePlannedDish(found.boardId, user.id, id, parsed.data)
  if (!moved) throw plannedDishNotFound()
  return moved
})
