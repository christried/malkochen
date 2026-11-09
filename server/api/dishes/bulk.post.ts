import { cookingDishIds, isUndoableCooking } from '../../utils/cookings'
import { bulkBody } from '../../utils/dish-input'
import { areDishesOfMember, cookDishes, deleteDishes, moveDishes, placeDishes, restoreDishes, uncookDishes, type CookedDish, type PlacedDish } from '../../utils/dishes'

// POST /api/dishes/bulk — several Dishes selected on a Board (#218), in one
// step, all or nothing:
// - `move`: to the top of a Column, on this Board or another of the user's
//   Boards, in the order sent; never a Gekocht Column (400), as cooking
//   several goes through `cook`.
// - `place`: "Rückgängig" after a move: each back to its Column (any of the
//   user's) at its index; a Gekocht Column only for a Dish that is Cooked
//   (400), as putting back records no Cooking.
// - `delete`: soft, as one Dish's delete (204); `restore` undoes it.
// - `cook`: "Gekocht ✓" on several (#451), all on one Board (400 otherwise):
//   a Cooking for each, and those outside the Gekocht Column to the top of
//   it, in the order sent; one already there stays. Answers each Dish placed
//   with the Cooking recorded for it (CookedDish), needing "move Dishes".
// - `uncook`: "Rückgängig" after it: each Cooking removed for good, as
//   one Cooking's undo removes it (only the user's own, the Dish's newest, just
//   recorded; else 409), and each Dish with a `back` put back at that Column
//   and index, which it must still be in a Gekocht Column for (else 400).
// Each needs its Permission for every Dish: "move Dishes" (and "add
// Dishes" on another Board moved to; "move Dishes" there, putting back),
// "archive Dishes" (or that the user added it); else 403, changing none.
// Answers the Dishes placed (PlacedDish), in the order sent. One Dish that
// is missing, deleted or on a Board the user isn't a Member of refuses all
// (404); so does a Column on a Board the user isn't a Member of (400).
export default defineEventHandler(async (event): Promise<PlacedDish[] | CookedDish[] | null> => {
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
    case 'cook': {
      await requireDishPermission(request.dishIds, userId, 'moveDishes')
      const cooked = await cookDishes(request.dishIds, userId)
      if (cooked) return cooked
      if (!await areDishesOfMember(request.dishIds, userId)) throw dishNotFound()
      throw createError({ statusCode: 400, statusMessage: 'Dishes not all on one Board' })
    }
    case 'uncook': {
      const cookingIds = request.cookings.map(c => c.cookingId)
      const dishIds = await cookingDishIds(cookingIds, userId)
      if (!dishIds) throw cookingNotFound()
      await requireMovePermission(dishIds, userId, request.cookings.flatMap(c => c.back ? [c.back.columnId] : []), { back: true })
      const undone = await uncookDishes(request.cookings, dishIds, userId)
      if (undone) return undone
      for (const cookingId of cookingIds) {
        if (!await isUndoableCooking(cookingId, userId)) throw createError({ statusCode: 409, statusMessage: 'Only the Cooking you just recorded can be undone' })
      }
      throw createError({ statusCode: 400, statusMessage: 'Dish not in Gekocht, or Column not on one of your Boards' })
    }
  }
})

// Why a move refused: a Dish the user can't move (404), else the Column.
async function refused(ids: string[], userId: string): Promise<never> {
  if (await areDishesOfMember(ids, userId)) throw createError({ statusCode: 400, statusMessage: 'Column not on one of your Boards, or a Gekocht Column' })
  throw dishNotFound()
}
