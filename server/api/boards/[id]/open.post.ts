import { standingOn } from '../../../utils/board-access'
import { markOpened } from '../../../utils/boards'

// The Board page calls this when it's shown, so the app reopens it next time.
export default defineEventHandler(async (event) => {
  const boardId = boardIdParam(event)
  const userId = requireUser(event).id
  // The Operator visiting (ADR 0009) has no Membership to write: a visit.
  if (!await markOpened(boardId, userId) && !await standingOn(boardId, userId)) throw boardNotFound()
  setResponseStatus(event, 204)
  return null
})
