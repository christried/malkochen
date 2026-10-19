import { restoreComment, type CommentView } from '../../../utils/comments'

// POST /api/comments/:id/restore — "Rückgängig" after deleting a Comment:
// it is back in the Dish History as it was. Whoever may delete it may bring
// it back; restoring one that isn't deleted changes nothing.
export default defineEventHandler(async (event): Promise<CommentView> => {
  const restored = await restoreComment(commentIdParam(event), requireUser(event).id)
  if (!restored) throw commentNotFound()
  if (restored === 'forbidden') throw createError({ statusCode: 403, statusMessage: 'Only its author or the Owner restores a Comment' })
  return restored
})
