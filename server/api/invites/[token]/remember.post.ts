import { inviteNotFound, inviteTokenParam, inviteView, rememberInvite } from '../../../utils/invites'

// POST /api/invites/:token/remember — the invite landing calls this as the
// visitor starts signing in, so the invite survives the trip to Google and a
// refused sign-in (PRD story 5). Public, like the landing itself.
export default defineEventHandler(async (event) => {
  const token = inviteTokenParam(event)
  if (!await inviteView(token)) throw inviteNotFound()
  rememberInvite(event, token)
  setResponseStatus(event, 204)
  return null
})
