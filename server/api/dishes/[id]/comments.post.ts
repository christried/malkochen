import { newCommentBody, writeComment, type CommentView } from '../../../utils/comments'
import { notifyComment } from '../../../utils/push'

// POST /api/dishes/:id/comments — writes a Comment on the Dish, from the
// comment field under its Dish History. Any Member with "comment and vote"
// may, Cooked or not. It notifies the Board's other Members. Written
// offline, it comes with the id the device made for it and when it was
// written (ADR 0012): a repeat of that id writes and notifies nothing again
// and answers the Comment as it is; an id another user's or another Dish's
// Comment has is refused (409).
export default defineEventHandler(async (event): Promise<CommentView> => {
  const dishId = dishIdParam(event)
  const parsed = newCommentBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Comment' })
  const user = requireUser(event)
  await requireDishPermission(dishId, user.id, 'commentAndVote')
  const { text, ...offline } = parsed.data
  const written = await writeComment(dishId, user.id, text, offline)
  if (written === 'taken') throw idTaken()
  if (!written) throw dishNotFound()
  if (!written.repeat) await notifyComment(dishId, written.comment.id, user.id)
  setResponseStatus(event, 201)
  return written.comment
})
