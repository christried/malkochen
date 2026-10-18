import { forgetInvite, inviteNotFound, inviteView, lookUpInvite, rememberedInvite, type InviteView } from '../../utils/invites'

// GET /api/invites/pending — the invite this browser remembers, for "Not
// unlocked" to name the Owner (PRD story 2). Public: a refused visitor has no
// session. A link reset meanwhile is forgotten.
export default defineEventHandler(async (event): Promise<InviteView> => {
  const secret = rememberedInvite(event)
  if (!secret) throw inviteNotFound()
  return lookUpInvite(event, async () => {
    const view = await inviteView(secret, callerLanguage(event))
    if (!view) forgetInvite(event)
    return view
  })
})
