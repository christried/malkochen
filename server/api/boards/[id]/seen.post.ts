import { standingOn } from '../../../utils/board-access'
import { getBoard, markSeen } from '../../../utils/boards'

// POST /api/boards/:id/seen — what an open Board asks every few seconds (PRD
// story 38): records that the user has seen it up to now, then answers the
// Board. Recording first: a Dish added in between comes back and still
// counts as New next time, never the other way round.
export default defineEventHandler(async (event) => {
  const boardId = boardIdParam(event)
  const userId = requireUser(event).id
  // The Operator visiting (ADR 0009) has no Membership to write: a visit.
  if (!await markSeen(boardId, userId) && !await standingOn(boardId, userId)) throw boardNotFound()
  const found = await getBoard(boardId, userId, callerLanguage(event))
  if (!found) throw boardNotFound()
  return found
})
