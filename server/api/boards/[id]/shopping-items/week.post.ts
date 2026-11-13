import { z } from 'zod'
import { isMember } from '../../../../utils/board-access'
import { madeAtInput } from '../../../../utils/late-changes'
import { isMonday, putWeekOn, type WeekPutOn } from '../../../../utils/shopping-list'

// `week`: its Monday, a calendar date in Europe/Berlin. `madeAt`: when it was
// made, if offline (late-changes.ts); its day is the "today" it counts from.
const body = z.object({ week: z.iso.date().refine(isMonday), madeAt: madeAtInput })

// POST /api/boards/:id/shopping-items/week — "Woche auf die Einkaufsliste":
// puts every Dish planned on the Week Plan from today (or the week's Monday,
// if later) to that week's Sunday on the Shopping List, each once with all
// its Ingredients, and answers how many Dishes went on (`dishes`, 0 when
// there was nothing to put on) and their items. Dishes already on the list,
// without Ingredients or archived are skipped. Sent late, it collects its
// Dishes as the Board is when it arrives. A week that is over: 400. Going
// over 500 items: 409 "Shopping List full", and nothing goes on. Every Member
// may, the Owner and the Operator too.
export default defineEventHandler(async (event): Promise<WeekPutOn> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A week\'s Monday is required' })
  const user = requireUser(event)
  if (!await isMember(boardId, user.id)) throw boardNotFound()
  const put = await putWeekOn(boardId, user.id, parsed.data)
  if (put === 'past') throw createError({ statusCode: 400, statusMessage: 'That week is over' })
  if (put === 'full') throw shoppingListFull()
  return put
})
