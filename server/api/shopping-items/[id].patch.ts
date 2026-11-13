import { z } from 'zod'
import { isMember } from '../../utils/board-access'
import { madeAtInput } from '../../utils/late-changes'
import { shoppingText } from '../../utils/shopping-input'
import { changeShoppingItem, shoppingItemBoard, type ShoppingItemView } from '../../utils/shopping-list'

// Either a new text or a tick, not both. `madeAt`: when it was made, if
// offline (late-changes.ts). Neither stores a time: the last one to arrive
// wins (ADR 0012).
const body = z.union([
  z.object({ text: shoppingText, madeAt: madeAtInput }).strict(),
  z.object({ ticked: z.boolean(), madeAt: madeAtInput }).strict(),
])

// PATCH /api/shopping-items/:id — changes a Shopping Item's text, or ticks or
// unticks it, and answers it. Every Member may, the Owner and the Operator
// too. Missing, deleted or cleared, or on a Board the user can't see: 404
// "Shopping Item not found", which the app drops quietly when it was sent
// late.
export default defineEventHandler(async (event): Promise<ShoppingItemView> => {
  const id = shoppingItemIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A text of 1 to 200 characters, or a tick, is required' })
  const user = requireUser(event)
  const found = await shoppingItemBoard(id)
  if (!found || !await isMember(found.boardId, user.id)) throw shoppingItemNotFound()
  const { madeAt: _, ...change } = parsed.data
  const changed = await changeShoppingItem(found.boardId, user.id, id, change)
  if (!changed) throw shoppingItemNotFound()
  return changed
})
