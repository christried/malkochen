import { switchDigestOff } from '../../utils/email-digest'

// DELETE /api/me/email-digest — switches the Email Digest off (#220). Off
// already: nothing changes.
export default defineEventHandler(async (event) => {
  await switchDigestOff(requireUser(event).id)
  setResponseStatus(event, 204)
  return null
})
