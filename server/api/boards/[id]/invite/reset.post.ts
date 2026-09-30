import { resetInvite } from '../../../../utils/invites'

// POST /api/boards/:id/invite/reset — the Owner gives the Board a new Invite
// Link; the old one stops working (PRD story 66).
export default defineEventHandler(async (event): Promise<{ inviteToken: string }> => {
  const reset = await resetInvite(boardIdParam(event), requireUser(event).id)
  if (reset === 'forbidden') throw createError({ statusCode: 403, statusMessage: 'Only the Owner can reset the Invite Link' })
  if (!reset) throw boardNotFound()
  return { inviteToken: reset }
})
