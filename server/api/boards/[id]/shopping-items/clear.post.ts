import { z } from 'zod'
import { isMember } from '../../../../utils/board-access'
import { madeAtInput } from '../../../../utils/late-changes'
import { clearTickedItems } from '../../../../utils/shopping-list'

// `madeAt`: when it was made, if offline (late-changes.ts). The body is
// optional.
const body = z.object({ madeAt: madeAtInput })

// POST /api/boards/:id/shopping-items/clear — "Erledigte entfernen": deletes
// every ticked item on the Board's Shopping List, for everyone, and answers
// their ids (`ids`) for "Rückgängig". Sent late, it clears what is ticked
// when it arrives. Every Member may, the Owner and the Operator too.
export default defineEventHandler(async (event): Promise<{ ids: string[] }> => {
  const boardId = boardIdParam(event)
  if (!body.safeParse(await readBody(event).catch(() => null) ?? {}).success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid made-at time' })
  }
  const user = requireUser(event)
  if (!await isMember(boardId, user.id)) throw boardNotFound()
  return { ids: await clearTickedItems(boardId, user.id) }
})
