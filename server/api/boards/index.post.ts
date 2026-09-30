import { z } from 'zod'
import { boardEmoji, boardName } from '../../utils/board-input'
import { createBoard, type BoardSummary } from '../../utils/boards'

const body = z.strictObject({ name: boardName, emoji: boardEmoji })

// POST /api/boards — "Neues Board": a Board with the default Columns, owned
// by whoever creates it.
export default defineEventHandler(async (event): Promise<BoardSummary> => {
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Board' })
  const created = await createBoard(requireUser(event).id, parsed.data)
  setResponseStatus(event, 201)
  return created
})
