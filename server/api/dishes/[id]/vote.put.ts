import { notifyVote } from '../../../utils/push'
import { setVote, voteBody, type VoteView } from '../../../utils/votes'

// PUT /api/dishes/:id/vote — gives the Member's Vote on the Dish, or
// changes it: from "Wie war's?" in its detail and the Gekocht toast. Any
// Member with "comment and vote" may, once the Dish is Cooked (409 before).
// A new Vote notifies the Board's other Members; a changed one doesn't.
export default defineEventHandler(async (event): Promise<VoteView> => {
  const dishId = dishIdParam(event)
  const parsed = voteBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Vote' })
  const user = requireUser(event)
  await requireDishPermission(dishId, user.id, 'commentAndVote')
  const voted = await setVote(dishId, user.id, parsed.data.up)
  if (!voted) throw dishNotFound()
  if (voted === 'uncooked') throw createError({ statusCode: 409, statusMessage: 'Only a Cooked Dish takes a Vote' })
  if (voted.given) await notifyVote(dishId, user.id)
  return voted.vote
})
