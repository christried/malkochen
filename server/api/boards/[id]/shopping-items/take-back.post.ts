import { z } from 'zod'
import { SHOPPING_LIMITS } from '../../../../../shared/shopping-list'
import { isMember } from '../../../../utils/board-access'
import { madeAtInput } from '../../../../utils/late-changes'
import { takeBackShoppingItems } from '../../../../utils/shopping-list'

const body = z.object({ ids: z.array(z.uuid()).min(1).max(SHOPPING_LIMITS.items), madeAt: madeAtInput })

// POST /api/boards/:id/shopping-items/take-back — "Rückgängig" after putting
// a Dish or a week on: deletes the items `ids` from the Board's Shopping List,
// for everyone, and answers the ids it took back (`ids`). Ids not on the list
// (gone, deleted already, another Board's) are left out. A restore brings them
// back like after a delete. Every Member may, the Owner and the Operator too.
export default defineEventHandler(async (event): Promise<{ ids: string[] }> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'The ids to take back are required' })
  const user = requireUser(event)
  if (!await isMember(boardId, user.id)) throw boardNotFound()
  return { ids: await takeBackShoppingItems(boardId, user.id, parsed.data.ids) }
})
