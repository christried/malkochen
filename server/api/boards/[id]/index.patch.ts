import { z } from 'zod'
import { boardEmoji, boardName } from '../../../utils/board-input'
import { editBoard, type BoardName } from '../../../utils/boards'

const body = z.strictObject({ name: boardName.optional(), emoji: boardEmoji.optional() })

// PATCH /api/boards/:id — Board settings: renames the Board or changes its
// emoji. Only the fields sent change.
export default defineEventHandler(async (event): Promise<BoardName> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Board changes' })
  const edited = await editBoard(boardId, requireUser(event).id, parsed.data)
  if (!edited) throw boardNotFound()
  return edited
})
