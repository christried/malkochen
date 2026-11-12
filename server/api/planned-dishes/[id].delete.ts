import { plannedDishBoard, unplanDish } from '../../utils/week-plan'

// DELETE /api/planned-dishes/:id — takes a Planned Dish off the Week Plan;
// its Dish stays on the Board, in its Column. Needs the Permission to move
// Dishes. Missing, on a Board the user can't see, or its Dish archived: 404.
export default defineEventHandler(async (event) => {
  const id = plannedDishIdParam(event)
  const user = requireUser(event)
  const found = await plannedDishBoard(id)
  if (!found) throw plannedDishNotFound()
  await requirePermission(found.boardId, user.id, 'moveDishes')
  if (!await unplanDish(found.boardId, user.id, id)) throw plannedDishNotFound()
  setResponseStatus(event, 204)
  return null
})
