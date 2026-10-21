import { z } from 'zod'
import { BOARD_LIMIT_REACHED } from '../../../shared/board'
import { boardEmoji, boardName } from '../../utils/board-input'
import { createBoard, type BoardSummary } from '../../utils/boards'

const body = z.strictObject({ name: boardName, emoji: boardEmoji })

// POST /api/boards — "Neues Board": a Board with the default Columns, in the
// creator's language, owned by whoever creates it. Refused (409) to someone
// who already has BOARDS_PER_USER Boards of their own (shared/board.ts).
export default defineEventHandler(async (event): Promise<BoardSummary> => {
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Board' })
  const user = requireUser(event)
  await spendRateLimit(user.id, 'create-board')
  const created = await createBoard(user.id, parsed.data, callerLanguage(event))
  if (!created) throw createError({ statusCode: BOARD_LIMIT_REACHED, statusMessage: 'Too many Boards' })
  setResponseStatus(event, 201)
  return created
})
