import { takeBackVote } from '../../../utils/votes'

// DELETE /api/dishes/:id/vote — takes the Member's Vote on the Dish back.
// Without one, nothing changes.
export default defineEventHandler(async (event) => {
  if (!await takeBackVote(dishIdParam(event), requireUser(event).id)) throw dishNotFound()
  setResponseStatus(event, 204)
  return null
})
