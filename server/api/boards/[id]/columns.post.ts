import { z } from 'zod'
import { columnName } from '../../../utils/board-input'
import { addColumn, type ColumnView } from '../../../utils/columns'

// Strict: a Column can't be sent in as a Gekocht Column; a Board has exactly one.
const body = z.strictObject({ name: columnName })

// POST /api/boards/:id/columns — Board settings, and the Board's add lane on
// desktop: adds a Column at the end.
export default defineEventHandler(async (event): Promise<ColumnView> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A Column needs a name' })
  const added = await addColumn(boardId, requireUser(event).id, parsed.data.name)
  if (!added) throw boardNotFound()
  setResponseStatus(event, 201)
  return added
})
