import { membersDish } from '../../../utils/dishes'
import { snackbertOn } from '../../../utils/snackbert'
import { reportedCookings } from '../../../utils/snackbert-reports'

// GET /api/dishes/:id/snackbert — for the Dish's detail (#424): whether the
// user has Snackbert on (`on`), and which of the Dish's Cookings they have
// sent Snackbert a Report of (`reported`). Only the user's own Reports: no
// one else's is ever shown. 404 for a Dish the user may not see, or one that
// is archived.
export default defineEventHandler(async (event): Promise<{ on: boolean, reported: string[] }> => {
  const dishId = dishIdParam(event)
  const user = requireUser(event)
  if (!await membersDish(dishId, user.id)) throw dishNotFound()
  const [on, reported] = await Promise.all([snackbertOn(user.id), reportedCookings(dishId, user.id)])
  return { on, reported }
})
