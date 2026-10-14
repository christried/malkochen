import { personCard, type PersonCard } from '../../../../utils/person-card'

// GET /api/boards/:id/people/:userId — what the user popover (#213) shows
// about someone, seen from the caller's Board: Username, Profile Picture,
// since when, the Dishes they added to this Board, the Boards both are on.
// Someone the caller shares no Board with is "not found", like nobody at
// all; so is anyone, for a non-Member of the Board.
export default defineEventHandler(async (event): Promise<PersonCard> => {
  const found = await personCard(boardIdParam(event), requireUser(event).id, getRouterParam(event, 'userId') ?? '')
  if (found === 'not-member') throw boardNotFound()
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Person not found' })
  return found
})
