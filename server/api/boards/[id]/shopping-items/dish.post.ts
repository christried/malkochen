import { z } from 'zod'
import { RECIPE_LIMITS } from '../../../../../shared/recipe'
import { isMember } from '../../../../utils/board-access'
import { madeAtInput } from '../../../../utils/late-changes'
import { shoppingText } from '../../../../utils/shopping-input'
import { putDishOn, type ShoppingItemView } from '../../../../utils/shopping-list'

// `items`: the lines chosen from the Dish's Ingredients on the device, in
// the Recipe's order, each with the id the device made for it (ADR 0012).
// `madeAt`: when it was made, if offline (late-changes.ts).
const body = z.object({
  dishId: z.uuid(),
  items: z.array(z.object({ id: z.uuid(), text: shoppingText })).min(1).max(RECIPE_LIMITS.ingredients.lines)
    .refine(items => new Set(items.map(i => i.id)).size === items.length),
  madeAt: madeAtInput,
})

// POST /api/boards/:id/shopping-items/dish — "Auf die Einkaufsliste": puts
// a Dish of the Board on its Shopping List with the chosen lines, at the end
// of the Dish's group (a new group, after the others, if it has none), and
// answers them. Putting it on again adds its lines again. Every Member may,
// the Owner and the Operator too. A Dish missing, archived or on another
// Board: 404 "Dish not found" (also when that happened while it was sent
// late); a Dish without Ingredients, or no lines: 400. Going over 500 items:
// 409 "Shopping List full", and nothing goes on. The same put-on sent again
// (its first `id`, Dish and user) puts nothing on twice (201).
export default defineEventHandler(async (event): Promise<ShoppingItemView[]> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A Dish and the lines to put on are required' })
  const user = requireUser(event)
  if (!await isMember(boardId, user.id)) throw boardNotFound()
  const put = await putDishOn(boardId, user.id, parsed.data)
  if (put === 'taken') throw idTaken()
  if (put === 'no-dish') throw dishNotFound()
  if (put === 'no-ingredients') throw createError({ statusCode: 400, statusMessage: 'The Dish has no Ingredients' })
  if (put === 'full') throw shoppingListFull()
  setResponseStatus(event, 201)
  return put
})
