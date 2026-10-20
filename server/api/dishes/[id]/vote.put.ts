import { setVote, voteBody, type VoteView } from '../../../utils/votes'

// PUT /api/dishes/:id/vote — gives the Member's Vote on the Dish, or
// changes it: from "Wie war's?" in its detail and the Gekocht toast. Any
// Member may, once the Dish is Cooked (409 before).
export default defineEventHandler(async (event): Promise<VoteView> => {
  const dishId = dishIdParam(event)
  const parsed = voteBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Vote' })
  const voted = await setVote(dishId, requireUser(event).id, parsed.data.up)
  if (!voted) throw dishNotFound()
  if (voted === 'uncooked') throw createError({ statusCode: 409, statusMessage: 'Only a Cooked Dish takes a Vote' })
  return voted
})
