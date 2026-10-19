import { commentBody, writeComment, type CommentView } from '../../../utils/comments'

// POST /api/dishes/:id/comments — writes a Comment on the Dish, from the
// comment field under its Dish History. Any Member may, Cooked or not.
export default defineEventHandler(async (event): Promise<CommentView> => {
  const dishId = dishIdParam(event)
  const parsed = commentBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Comment' })
  const written = await writeComment(dishId, requireUser(event).id, parsed.data.text)
  if (!written) throw dishNotFound()
  setResponseStatus(event, 201)
  return written
})
