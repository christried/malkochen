import { inviteSecretParam, inviteView, lookUpInvite, type InviteView } from '../../../utils/invites'

// GET /api/invites/:token — the invite landing: which Board, invited by whom.
// `:token` is what follows /invite/ in the link (its secret, after the
// Board's slug). Public: whoever has the link may see this much before
// signing in.
export default defineEventHandler(async (event): Promise<InviteView> => {
  const secret = inviteSecretParam(event)
  return lookUpInvite(event, () => inviteView(secret))
})
