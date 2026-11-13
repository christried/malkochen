import { z } from 'zod'
import { SHOPPING_LIMITS } from '../../../../../shared/shopping-list'
import { isMember } from '../../../../utils/board-access'
import { madeAtInput } from '../../../../utils/late-changes'
import { restoreShoppingItems, type ShoppingItemView } from '../../../../utils/shopping-list'

const body = z.object({ ids: z.array(z.uuid()).min(1).max(SHOPPING_LIMITS.items), madeAt: madeAtInput })

// POST /api/boards/:id/shopping-items/restore — "Rückgängig" after deleting
// an item or "Erledigte entfernen": brings the deleted items `ids` back as
// they were (their ids, ticks, groups and places) and answers those it
// brought back, in the list's order. Ids not deleted, or not of this Board,
// are left out. If they wouldn't fit on the list: 409 "Shopping List full",
// and none comes back. Every Member may, the Owner and the Operator too.
export default defineEventHandler(async (event): Promise<ShoppingItemView[]> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'The ids to restore are required' })
  const user = requireUser(event)
  if (!await isMember(boardId, user.id)) throw boardNotFound()
  const restored = await restoreShoppingItems(boardId, user.id, parsed.data.ids)
  if (restored === 'full') throw shoppingListFull()
  return restored
})
