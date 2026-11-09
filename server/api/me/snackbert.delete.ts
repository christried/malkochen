import { switchSnackbertOff } from '../../utils/snackbert'

// DELETE /api/me/snackbert — switches Snackbert off (#423). Off already, or
// without Snackbert set up: nothing changes. Snackbert is never asked.
export default defineEventHandler(async (event) => {
  await switchSnackbertOff(requireUser(event).id)
  setResponseStatus(event, 204)
  return null
})
