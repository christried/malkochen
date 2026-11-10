import { z } from 'zod'
import { cookDish, type MovedDish } from '../../../utils/dishes'
import { deviceIdInput, madeAtInput } from '../../../utils/late-changes'

// Sent from offline (late-changes.ts): the Cooking's device-made id and
// when it was tapped. Both optional, as is the body.
const body = z.object({ cookingId: deviceIdInput, madeAt: madeAtInput })

// POST /api/dishes/:id/cook — the "Gekocht ✓" quick action: records a
// Cooking and moves the Dish to the top of its Board's Gekocht Column (one
// already there stays put). The answer's `cooking` is the one recorded.
export default defineEventHandler(async (event): Promise<MovedDish> => {
  const dishId = dishIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null) ?? {})
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Cooking' })
  const userId = requireUser(event).id
  // Into the Gekocht Column: a move, the user's own Dish too.
  await requireDishPermission(dishId, userId, 'moveDishes')
  const cooked = await cookDish(dishId, userId, parsed.data)
  if (cooked === 'taken') throw idTaken()
  if (!cooked) throw dishNotFound()
  return cooked
})
