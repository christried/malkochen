import { z } from 'zod'
import { reorderColumns, type ColumnView } from '../../../utils/columns'

const body = z.strictObject({ columnIds: z.array(z.uuid()).min(1).max(100) })

// PUT /api/boards/:id/columns — Board settings: puts the Columns in a new
// order, given as all of the Board's Column ids.
export default defineEventHandler(async (event): Promise<ColumnView[]> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Column order' })
  const columns = await reorderColumns(boardId, requireUser(event).id, parsed.data.columnIds)
  if (!columns) throw boardNotFound()
  if (columns === 'invalid') throw createError({ statusCode: 400, statusMessage: 'The order must name each Column of the Board once' })
  return columns
})
