import { z } from 'zod'
import { columnName } from '../../utils/board-input'
import { renameColumn, type ColumnView } from '../../utils/columns'

// Strict: whether a Column is the Gekocht Column never changes.
const body = z.strictObject({ name: columnName })

// PATCH /api/columns/:id — Board settings: renames a Column.
export default defineEventHandler(async (event): Promise<ColumnView> => {
  const columnId = columnIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A Column needs a name' })
  const renamed = await renameColumn(columnId, requireUser(event).id, parsed.data.name)
  if (!renamed) throw columnNotFound()
  return renamed
})
