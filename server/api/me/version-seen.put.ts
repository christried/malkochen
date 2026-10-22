import { recordVersionSeen, type Me } from '../../utils/people'

// PUT /api/me/version-seen — the user opened the Changelog (#354), on
// whichever device: the app's Version is no longer new to them, so Your
// Settings drops the "Neu". Answers /api/me's answer.
export default defineEventHandler(async (event): Promise<Me> => {
  const me = await recordVersionSeen(requireUser(event).id)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return me
})
