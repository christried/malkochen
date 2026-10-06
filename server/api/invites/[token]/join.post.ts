import { forgetInvite, inviteSecretParam, joinByInvite, lookUpInvite } from '../../../utils/invites'

// POST /api/invites/:token/join — makes the signed-in user a Member of the
// link's Board, or does nothing if they already are. Answers the Board to
// open: its id and the slug of its Address.
export default defineEventHandler(async (event): Promise<{ boardId: string, slug: string }> => {
  const secret = inviteSecretParam(event)
  const user = requireUser(event)
  const joined = await lookUpInvite(event, () => joinByInvite(secret, user.id))
  forgetInvite(event)
  return joined
})
