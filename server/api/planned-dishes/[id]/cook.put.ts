import { z } from 'zod'
import { plannedDishBoard, setPlannedDishCook, type PlannedDishView } from '../../../utils/week-plan'

const body = z.object({ cookId: z.string().min(1).nullable() })

// PUT /api/planned-dishes/:id/cook — sets who cooks a Planned Dish ("Wer
// kocht"), or clears the cook with `cookId: null`, and answers it. The cook
// must be a Member of the Board (400 otherwise). Needs the Permission to move
// Dishes. Missing, on a Board the user can't see, or its Dish archived: 404.
export default defineEventHandler(async (event): Promise<PlannedDishView> => {
  const id = plannedDishIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A cook or null is required' })
  const user = requireUser(event)
  const found = await plannedDishBoard(id)
  if (!found) throw plannedDishNotFound()
  await requirePermission(found.boardId, user.id, 'moveDishes')
  const set = await setPlannedDishCook(found.boardId, user.id, id, parsed.data.cookId)
  if (!set) throw plannedDishNotFound()
  if (set === 'not-member') throw createError({ statusCode: 400, statusMessage: 'Cook not a Member of this Board' })
  return set
})
