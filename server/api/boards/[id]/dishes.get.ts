import { z } from 'zod'
import { isMember } from '../../../utils/boards'
import { searchDishes, type FoundDish } from '../../../utils/dishes'

const query = z.object({ q: z.string().trim().min(1).max(200) })

// GET /api/boards/:id/dishes?q=… — the Board's Dishes whose title contains
// the query (PRD story 36). The Board's search asks as the user types.
export default defineEventHandler(async (event): Promise<{ dishes: FoundDish[] }> => {
  const boardId = boardIdParam(event)
  const parsed = query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A search query is required' })
  if (!await isMember(boardId, requireUser(event).id)) throw boardNotFound()
  return { dishes: await searchDishes(boardId, parsed.data.q) }
})
