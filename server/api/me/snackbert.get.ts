import { snackbertFor } from '../../utils/snackbert'

// GET /api/me/snackbert — whether the user has a Snackbert account (`available`,
// asked of Snackbert once a day at most) and has Snackbert switched on (`on`)
// (#423). Without Snackbert set up, neither is ever true.
export default defineEventHandler(async (event): Promise<{ available: boolean, on: boolean }> => {
  const user = requireUser(event)
  return snackbertFor(user.id, user.email)
})
