import { inviteNotFound, inviteTokenParam, inviteView, type InviteView } from '../../../utils/invites'

// GET /api/invites/:token — the invite landing: which Board, invited by whom.
// Public: whoever has the link may see this much before signing in.
export default defineEventHandler(async (event): Promise<InviteView> => {
  const view = await inviteView(inviteTokenParam(event))
  if (!view) throw inviteNotFound()
  return view
})
