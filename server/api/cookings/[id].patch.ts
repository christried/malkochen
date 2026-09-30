import { z } from 'zod'
import { noteCooking, type CookingView } from '../../utils/cookings'
import { dishNote } from '../../utils/dish-input'

// A blank note removes it.
const body = z.object({ note: dishNote })

// PATCH /api/cookings/:id — the Cooking note sheet, from the Gekocht toast
// or the Cooking History.
export default defineEventHandler(async (event): Promise<CookingView> => {
  const cookingId = cookingIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid note' })
  const noted = await noteCooking(cookingId, requireUser(event).id, parsed.data.note)
  if (!noted) throw cookingNotFound()
  return noted
})
