import { digestOffered, switchDigestOn } from '../../utils/email-digest'

// PUT /api/me/email-digest — switches the Email Digest on (#220), for all
// the user's Boards. On already: nothing changes. 503 when the server has no
// Resend API key.
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  if (!digestOffered) throw createError({ statusCode: 503, statusMessage: 'The email digest is not set up' })
  await switchDigestOn(user.id)
  setResponseStatus(event, 204)
  return null
})
