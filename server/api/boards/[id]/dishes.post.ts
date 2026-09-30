import { z } from 'zod'
import { PLACEHOLDERS } from '../../../../shared/placeholders'
import { addDish } from '../../../utils/dishes'

const body = z.object({
  title: z.string().trim().min(1).max(200),
  // Optional; a blank note is no note.
  note: z.string().trim().max(2000).nullish().transform(note => note || null),
  placeholder: z.enum(PLACEHOLDERS),
})

// POST /api/boards/:id/dishes — adds a Dish without a Source ("Ohne Link
// hinzufügen") at the top of the Board's first Column.
export default defineEventHandler(async (event) => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A title and a Placeholder Image are required' })

  const created = await addDish(boardId, requireUser(event), parsed.data)
  if (!created) throw boardNotFound()
  setResponseStatus(event, 201)
  return created
})
