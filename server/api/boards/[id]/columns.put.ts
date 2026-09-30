import { z } from 'zod'
import { isMember } from '../../../utils/boards'
import { reorderColumns, type ColumnView } from '../../../utils/columns'

const body = z.strictObject({ columnIds: z.array(z.uuid()).min(1).max(100) })

// PUT /api/boards/:id/columns — Board settings: puts the Columns in a new
// order, given as all of the Board's Column ids. An order that leaves one
// out, names one twice or names another Board's is refused.
export default defineEventHandler(async (event): Promise<ColumnView[]> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Column order' })
  const user = requireUser(event)
  const columns = await reorderColumns(boardId, user.id, parsed.data.columnIds)
  if (columns) return columns
  if (await isMember(boardId, user.id)) throw createError({ statusCode: 400, statusMessage: 'The order must name each Column of the Board once' })
  throw boardNotFound()
})
