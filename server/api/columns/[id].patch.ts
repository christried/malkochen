import { z } from 'zod'
import { columnName, columnSubtitle } from '../../utils/board-input'
import { editColumn, type ColumnView } from '../../utils/columns'

// Strict: whether a Column is the Gekocht Column never changes.
const body = z
  .strictObject({ name: columnName.optional(), subtitle: columnSubtitle.optional() })
  .refine(changes => Object.keys(changes).length > 0)

// PATCH /api/columns/:id — Board settings: renames a Column, or sets or
// clears its Column Subtitle (null or blank clears it). The Gekocht Column's
// subtitle is fixed: changing it answers 400.
export default defineEventHandler(async (event): Promise<ColumnView> => {
  const columnId = columnIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A Column needs a name, and a subtitle has at most 40 characters' })
  const edited = await editColumn(columnId, requireUser(event).id, parsed.data)
  if (!edited) throw columnNotFound()
  if (edited === 'gekocht') throw createError({ statusCode: 400, statusMessage: 'The Gekocht Column’s subtitle can’t be changed' })
  return edited
})
