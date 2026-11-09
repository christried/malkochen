import { snackbertOffered, switchSnackbertOn } from '../../utils/snackbert'

// PUT /api/me/snackbert — switches Snackbert on (#423), after asking Snackbert
// whether the user's email address has an account there. On already: nothing
// changes. 503 when the server has no Snackbert; 409 when Snackbert has no
// account for the address; 502 when Snackbert can't be reached.
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  if (!snackbertOffered) throw createError({ statusCode: 503, statusMessage: 'Snackbert is not set up' })
  const result = await switchSnackbertOn(user.id, user.email)
  if (result === 'no-account') throw createError({ statusCode: 409, statusMessage: 'No Snackbert account for this email address' })
  if (result === 'unreachable') throw createError({ statusCode: 502, statusMessage: 'Snackbert is not reachable' })
  setResponseStatus(event, 204)
  return null
})
