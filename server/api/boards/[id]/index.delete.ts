import { archiveBoard } from '../../../utils/archived-boards'

// DELETE /api/boards/:id — "Board löschen": the Owner archives the Board for
// every Member (CONTEXT.md: Archived Board), restorable for 30 days from
// their Board Switcher. Board settings has them type its name first.
export default defineEventHandler(async (event) => {
  const result = await archiveBoard(boardIdParam(event), requireUser(event).id)
  if (!result) throw boardNotFound()
  if (result === 'forbidden') throw createError({ statusCode: 403, statusMessage: 'Only the Owner can delete the Board' })
  setResponseStatus(event, 204)
  return null
})
