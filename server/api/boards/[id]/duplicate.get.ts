import { z } from 'zod'
import { guessSource } from '../../../source-lookup'
import { isMember } from '../../../utils/boards'
import { dishWithSource, type DuplicateDish } from '../../../utils/dishes'

const query = z.object({ link: z.url({ protocol: /^https?$/ }).max(2048) })

// GET /api/boards/:id/duplicate?link=… — whether a Dish with this Source is
// already on the Board, compared by canonical link, so another form of the
// same link counts too. Add Dish asks before saving and warns if so.
export default defineEventHandler(async (event): Promise<{ duplicate: DuplicateDish | null }> => {
  const boardId = boardIdParam(event)
  const parsed = query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A web link is required' })
  if (!await isMember(boardId, requireUser(event).id)) throw boardNotFound()
  return { duplicate: await dishWithSource(boardId, guessSource(parsed.data.link).canonicalLink) }
})
