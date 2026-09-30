import { forgetInvite, inviteNotFound, inviteView, rememberedInvite, type InviteView } from '../../utils/invites'

// GET /api/invites/pending — the invite this browser remembers, for "Not
// unlocked" to name the Owner (PRD story 2). Public: a refused visitor has no
// session. A link reset meanwhile is forgotten.
export default defineEventHandler(async (event): Promise<InviteView> => {
  const token = rememberedInvite(event)
  const view = token ? await inviteView(token) : null
  if (!view) {
    if (token) forgetInvite(event)
    throw inviteNotFound()
  }
  return view
})
