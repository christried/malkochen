import { z } from 'zod'
import { isMember } from '../../utils/board-access'
import { madeAtInput } from '../../utils/late-changes'
import { deleteShoppingItem, shoppingItemBoard } from '../../utils/shopping-list'

// `madeAt`: when it was made, if offline (late-changes.ts). The body is
// optional.
const body = z.object({ madeAt: madeAtInput })

// DELETE /api/shopping-items/:id — deletes a Shopping Item from the list;
// "Rückgängig" restores it (POST /api/boards/:id/shopping-items/restore).
// Every Member may, the Owner and the Operator too. Missing, deleted or
// cleared already, or on a Board the user can't see: 404 "Shopping Item not
// found", which the app drops quietly when it was sent late.
export default defineEventHandler(async (event) => {
  const id = shoppingItemIdParam(event)
  if (!body.safeParse(await readBody(event).catch(() => null) ?? {}).success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid made-at time' })
  }
  const user = requireUser(event)
  const found = await shoppingItemBoard(id)
  if (!found || !await isMember(found.boardId, user.id)) throw shoppingItemNotFound()
  if (!await deleteShoppingItem(found.boardId, user.id, id)) throw shoppingItemNotFound()
  setResponseStatus(event, 204)
  return null
})
