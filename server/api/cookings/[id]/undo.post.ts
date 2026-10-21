import { z } from 'zod'
import { cookingDishId, isUndoableCooking } from '../../../utils/cookings'
import { undoCooking, type PlacedDish } from '../../../utils/dishes'

// Where the Dish was before it was cooked: its Column, and its place among
// that Column's other Dishes.
const body = z.object({ columnId: z.uuid(), index: z.int().min(0).max(100_000) })

// POST /api/cookings/:id/undo — "Rückgängig" in the Gekocht toast: the
// Cooking is removed for good and the Dish goes back where it was, and the
// answer says where that is (PlacedDish): back on its own Board, also after
// it was moved into another Board's Gekocht Column. Only for the Cooking
// the toast offers it for (#197): the Dish's newest, recorded by the user
// in the last few minutes; any other is refused (409), and only the soft
// delete (DELETE /api/cookings/:id) removes it. Refused (400) for a Column
// on a Board the user isn't a Member of, or once the Dish has left the
// Gekocht Column.
export default defineEventHandler(async (event): Promise<PlacedDish> => {
  const cookingId = cookingIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid place' })
  const user = requireUser(event)
  await requireCookingPermission(cookingId, user.id, [parsed.data.columnId])
  const dishId = await cookingDishId(cookingId, user.id)
  if (!dishId) throw cookingNotFound()
  const undone = await undoCooking(cookingId, dishId, user.id, parsed.data.columnId, parsed.data.index)
  if (undone) return undone
  // The Dish, or the Cooking from its Cooking History, deleted meanwhile:
  // gone.
  if (!await cookingDishId(cookingId, user.id)) throw cookingNotFound()
  if (!await isUndoableCooking(cookingId, user.id)) throw notUndoable()
  throw createError({ statusCode: 400, statusMessage: 'Dish not in Gekocht, or Column not on one of your Boards' })
})

function notUndoable() {
  return createError({ statusCode: 409, statusMessage: 'Only the Cooking you just recorded can be undone' })
}
