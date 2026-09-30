import { forgetInvite, inviteNotFound, inviteTokenParam, joinByInvite } from '../../../utils/invites'

// POST /api/invites/:token/join — makes the signed-in user a Member of the
// link's Board, or does nothing if they already are. Answers the Board to open.
export default defineEventHandler(async (event): Promise<{ boardId: string }> => {
  const boardId = await joinByInvite(inviteTokenParam(event), requireUser(event).id)
  if (!boardId) throw inviteNotFound()
  forgetInvite(event)
  return { boardId }
})
