import { findMe, type Me } from '../../utils/people'

// The signed-in user. Guarded like every /api/** route, so the page guard
// (app/middleware/auth.global.ts) gets 401 when signed out and 403 when the
// Allowlist no longer includes the user -- which get-session can't tell it.
// Their name, picture (own Profile Picture, else Google photo) and own
// Profile Picture also show in their settings.
export default defineEventHandler(async (event): Promise<Me> => {
  const me = await findMe(requireUser(event).id)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return me
})
