import { deleteBoard } from '../../../utils/members'

// DELETE /api/boards/:id — the Owner deletes the Board for every Member. Board
// settings has them type its name first.
export default defineEventHandler(async (event) => {
  const result = await deleteBoard(boardIdParam(event), requireUser(event).id)
  if (!result) throw boardNotFound()
  if (result === 'forbidden') throw createError({ statusCode: 403, statusMessage: 'Only the Owner can delete the Board' })
  setResponseStatus(event, 204)
  return null
})
