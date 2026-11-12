import { z } from 'zod'
import { planDish, type PlannedDishView } from '../../../utils/week-plan'

// `id`: made on the device (ADR 0012). `day`: a calendar date in
// Europe/Berlin. `index`: its place among the day's other Dishes.
const body = z.object({
  id: z.uuid(),
  dishId: z.uuid(),
  day: z.iso.date(),
  index: z.int().min(0).max(100_000).optional(),
})

// POST /api/boards/:id/planned-dishes — puts a Dish of the Board on a day of
// its Week Plan (CONTEXT.md: Planned Dish), at `index` among the day's other
// Planned Dishes or at the day's end, and answers it. The Dish stays in its
// Column. Needs the Permission to move Dishes, for the Dish's adder too. A
// Dish that is missing, on another Board or archived is refused (404), and
// so is an `id` another Planned Dish has (409).
export default defineEventHandler(async (event): Promise<PlannedDishView> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A Dish and a day are required' })
  const user = requireUser(event)
  await requirePermission(boardId, user.id, 'moveDishes')
  const planned = await planDish(boardId, user.id, parsed.data)
  if (planned === 'taken') throw idTaken()
  if (!planned) throw dishNotFound()
  setResponseStatus(event, 201)
  return planned
})
