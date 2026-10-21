import { commentBody, writeComment, type CommentView } from '../../../utils/comments'
import { notifyComment } from '../../../utils/push'

// POST /api/dishes/:id/comments — writes a Comment on the Dish, from the
// comment field under its Dish History. Any Member with "comment and vote"
// may, Cooked or not. It notifies the Board's other Members.
export default defineEventHandler(async (event): Promise<CommentView> => {
  const dishId = dishIdParam(event)
  const parsed = commentBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Comment' })
  const user = requireUser(event)
  await requireDishPermission(dishId, user.id, 'commentAndVote')
  const written = await writeComment(dishId, user.id, parsed.data.text)
  if (!written) throw dishNotFound()
  await notifyComment(dishId, written.id, user.id)
  setResponseStatus(event, 201)
  return written
})
