import { commentBody, editComment, type CommentView } from '../../utils/comments'

// PATCH /api/comments/:id — its author changes a Comment's text, which is
// then marked "bearbeitet". Refused (403) to anyone else, the Owner too,
// and to its author without "comment and vote".
export default defineEventHandler(async (event): Promise<CommentView> => {
  const commentId = commentIdParam(event)
  const parsed = commentBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Comment' })
  const user = requireUser(event)
  await requireCommentPermission(commentId, user.id, 'commentAndVote')
  const edited = await editComment(commentId, user.id, parsed.data.text)
  if (!edited) throw commentNotFound()
  if (edited === 'forbidden') throw createError({ statusCode: 403, statusMessage: 'Only its author edits a Comment' })
  return edited
})
