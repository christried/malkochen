import { removeMember, type MemberRefusal } from '../../../../utils/members'

const REFUSED = {
  'owner': { statusCode: 409, statusMessage: 'The Owner hands over ownership before leaving' },
  'forbidden': { statusCode: 403, statusMessage: 'Only the Owner can remove a Member' },
  'not-member': { statusCode: 404, statusMessage: 'Member not found' },
} satisfies Record<MemberRefusal, { statusCode: number, statusMessage: string }>

// DELETE /api/boards/:id/members/:userId — a Member leaves the Board (their
// own id), or the Owner removes someone. The Dishes they added stay.
export default defineEventHandler(async (event) => {
  const result = await removeMember(boardIdParam(event), requireUser(event).id, getRouterParam(event, 'userId') ?? '')
  if (!result) throw boardNotFound()
  if (result !== 'removed') throw createError(REFUSED[result])
  setResponseStatus(event, 204)
  return null
})
