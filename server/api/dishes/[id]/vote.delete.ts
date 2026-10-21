import { takeBackVote } from '../../../utils/votes'

// DELETE /api/dishes/:id/vote — takes the Member's Vote on the Dish back.
// Without one, nothing changes. Needs "comment and vote", as giving it does.
export default defineEventHandler(async (event) => {
  const dishId = dishIdParam(event)
  const user = requireUser(event)
  await requireDishPermission(dishId, user.id, 'commentAndVote')
  if (!await takeBackVote(dishId, user.id)) throw dishNotFound()
  setResponseStatus(event, 204)
  return null
})
