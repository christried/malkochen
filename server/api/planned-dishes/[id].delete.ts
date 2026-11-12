import { z } from 'zod'
import { madeAtInput } from '../../utils/late-changes'
import { plannedDishBoard, unplanDish } from '../../utils/week-plan'

// `madeAt`: when it was made, if offline (late-changes.ts). Unplanning stores
// no time. The body is optional.
const body = z.object({ madeAt: madeAtInput })

// DELETE /api/planned-dishes/:id — takes a Planned Dish off the Week Plan;
// its Dish stays on the Board, in its Column. Needs the Permission to move
// Dishes. Missing, on a Board the user can't see, or its Dish archived: 404.
// Sent late, it is dropped (404) if the Planned Dish is gone by then.
export default defineEventHandler(async (event) => {
  const id = plannedDishIdParam(event)
  if (!body.safeParse(await readBody(event).catch(() => null) ?? {}).success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid made-at time' })
  }
  const user = requireUser(event)
  const found = await plannedDishBoard(id)
  if (!found) throw plannedDishNotFound()
  await requirePermission(found.boardId, user.id, 'moveDishes')
  if (!await unplanDish(found.boardId, user.id, id)) throw plannedDishNotFound()
  setResponseStatus(event, 204)
  return null
})
