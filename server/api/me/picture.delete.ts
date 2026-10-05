import { setOwnPicture, type Me } from '../../utils/people'

// DELETE /api/me/picture — removes the user's own Profile Picture: their
// Google photo shows again, or their initial without one. Answers /api/me's
// answer.
export default defineEventHandler(async (event): Promise<Me> => {
  const me = await setOwnPicture(requireUser(event).id, null)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return me
})
