import { deleteComment } from '../../utils/comments'

// DELETE /api/comments/:id — deletes a Comment: its author their own, the
// Board's Owner any (403 for anyone else). A soft delete: POST
// /api/comments/:id/restore undoes it.
export default defineEventHandler(async (event) => {
  const deleted = await deleteComment(commentIdParam(event), requireUser(event).id)
  if (!deleted) throw commentNotFound()
  if (deleted === 'forbidden') throw createError({ statusCode: 403, statusMessage: 'Only its author or the Owner deletes a Comment' })
  setResponseStatus(event, 204)
  return null
})
