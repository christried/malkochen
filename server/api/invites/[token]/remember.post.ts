import { inviteSecretParam, inviteView, lookUpInvite, rememberInvite } from '../../../utils/invites'

// POST /api/invites/:token/remember — the invite landing calls this as the
// visitor starts signing in, so the invite survives the trip to Google and a
// refused sign-in (PRD story 5). Public, like the landing itself.
export default defineEventHandler(async (event) => {
  const secret = inviteSecretParam(event)
  await lookUpInvite(event, () => inviteView(secret))
  rememberInvite(event, secret)
  setResponseStatus(event, 204)
  return null
})
