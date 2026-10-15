import { isDigestOn } from '../../utils/email-digest'

// GET /api/me/email-digest — whether the user switched the Email Digest on
// (#220), which their settings show.
export default defineEventHandler(async (event): Promise<{ on: boolean }> => {
  return { on: await isDigestOn(requireUser(event).id) }
})
