import { bulkBody } from '../../utils/dish-input'
import { areDishesOfMember, deleteDishes, moveDishes, placeDishes, restoreDishes, type PlacedDish } from '../../utils/dishes'

// POST /api/dishes/bulk — several Dishes selected on a Board (#218), in one
// step, all or nothing:
// - `move`: to the top of a Column, on this Board or another of the user's
//   Boards, in the order sent; never a Gekocht Column (400), as cooking
//   stays one Dish at a time.
// - `place`: "Rückgängig" after a move: each back to its Column (any of the
//   user's) at its index; a Gekocht Column only for a Dish that is Cooked
//   (400), as putting back records no Cooking.
// - `delete`: soft, as one Dish's delete (204); `restore` undoes it.
// Each needs its Permission for every Dish: "move Dishes" (and "add
// Dishes" on another Board moved to; "move Dishes" there, putting back),
// "archive Dishes" (or that the user added it); else 403, changing none.
// Answers the Dishes placed (PlacedDish), in the order sent. One Dish that
// is missing, deleted or on a Board the user isn't a Member of refuses all
// (404); so does a Column on a Board the user isn't a Member of (400).
export default defineEventHandler(async (event): Promise<PlacedDish[] | null> => {
  const parsed = bulkBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid bulk request' })
  const userId = requireUser(event).id
  const request = parsed.data
  switch (request.action) {
    case 'move':
      await requireMovePermission(request.dishIds, userId, [request.columnId])
      return await moveDishes(request.dishIds, userId, request.columnId) ?? refused(request.dishIds, userId)
    case 'place':
      await requireMovePermission(request.places.map(p => p.dishId), userId, request.places.map(p => p.columnId), { back: true })
      return await placeDishes(request.places, userId) ?? refused(request.places.map(p => p.dishId), userId)
    case 'delete':
      await requireDishPermission(request.dishIds, userId, 'archiveDishes')
      if (!await deleteDishes(request.dishIds, userId)) throw dishNotFound()
      setResponseStatus(event, 204)
      return null
    case 'restore': {
      await requireDishPermission(request.dishIds, userId, 'archiveDishes')
      const restored = await restoreDishes(request.dishIds, userId)
      if (!restored) throw dishNotFound()
      return restored
    }
  }
})

// Why a move refused: a Dish the user can't move (404), else the Column.
async function refused(ids: string[], userId: string): Promise<never> {
  if (await areDishesOfMember(ids, userId)) throw createError({ statusCode: 400, statusMessage: 'Column not on one of your Boards, or a Gekocht Column' })
  throw dishNotFound()
}
