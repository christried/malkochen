import { z } from 'zod'
import { columnOrFirst, isDishMember, moveDish, type MovedDish } from '../../../utils/dishes'
import { deviceIdInput, madeAtInput } from '../../../utils/late-changes'

// `index`: where drag and drop put it among the Column's other Dishes.
// Sent from offline (late-changes.ts): the device-made id of the Cooking a
// move into a Gekocht Column records, and when the move was made.
const body = z.object({
  columnId: z.uuid(),
  index: z.int().min(0).max(100_000).optional(),
  cookingId: deviceIdInput,
  madeAt: madeAtInput,
})

// POST /api/dishes/:id/move — "Verschieben nach…": the Dish goes to the top
// of another Column, on its Board or another of the user's Boards; dragged,
// it goes to `index` in any Column. Moved into a Gekocht Column, it records
// a Cooking: the answer's `cooking`. A Column on a Board the user isn't a
// Member of is refused. Sent late (with `madeAt`), a Column deleted meanwhile
// (the move waited on the device, ADR 0012) puts it at the top of its
// Board's first Column; without, a missing Column is refused as ever.
export default defineEventHandler(async (event): Promise<MovedDish> => {
  const dishId = dishIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Column' })
  const user = requireUser(event)
  const { cookingId, madeAt } = parsed.data
  const { columnId, deleted } = madeAt ? await columnOrFirst(parsed.data.columnId, [dishId]) : { columnId: parsed.data.columnId, deleted: false }
  await requireMovePermission([dishId], user.id, [columnId])
  const moved = await moveDish(dishId, user.id, columnId, { index: deleted ? undefined : parsed.data.index, cookingId, madeAt })
  if (moved === 'taken') throw idTaken()
  if (moved) return moved
  if (await isDishMember(dishId, user.id)) throw createError({ statusCode: 400, statusMessage: 'Column not on one of your Boards' })
  throw dishNotFound()
})
