import { z } from 'zod'
import { isMember } from '../../../../utils/board-access'
import { madeAtInput } from '../../../../utils/late-changes'
import { shoppingText } from '../../../../utils/shopping-input'
import { addShoppingItem, type ShoppingItemView } from '../../../../utils/shopping-list'

// `id`: made on the device (ADR 0012). `madeAt`: when it was made, if offline
// (late-changes.ts).
const body = z.object({ id: z.uuid(), text: shoppingText, madeAt: madeAtInput })

// POST /api/boards/:id/shopping-items — types an item into "Sonstiges" on
// the Board's Shopping List (CONTEXT.md: Shopping Item), at its end, and
// answers it. Every Member may, the Owner and the Operator too; no
// Permission. Text empty or over 200 characters: 400. A list holding 500
// items already: 409 "Shopping List full". An `id` another item has: 409
// "Id already taken". The same add sent again (same `id`, Board and user)
// adds nothing twice and answers the item as it is now (201).
export default defineEventHandler(async (event): Promise<ShoppingItemView> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A text of 1 to 200 characters is required' })
  const user = requireUser(event)
  if (!await isMember(boardId, user.id)) throw boardNotFound()
  const added = await addShoppingItem(boardId, user.id, parsed.data)
  if (added === 'taken') throw idTaken()
  if (added === 'full') throw shoppingListFull()
  setResponseStatus(event, 201)
  return added
})
