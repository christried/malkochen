import { z } from 'zod'
import { deleteColumn, type ColumnRefusal } from '../../utils/columns'

const query = z.object({ moveTo: z.uuid().optional() })

const REFUSED = {
  'gekocht': 'The Gekocht Column can’t be deleted',
  'last': 'A Board keeps at least one Column besides Gekocht',
  'not-empty': 'The Column has Dishes: say which Column they move to',
  'bad-target': 'Dishes can only move to another Column of this Board',
} satisfies Record<ColumnRefusal, string>

// DELETE /api/columns/:id[?moveTo=<Column id>] — Board settings: deletes a
// Column. One with Dishes needs `moveTo`, where its Dishes go.
export default defineEventHandler(async (event) => {
  const columnId = columnIdParam(event)
  const parsed = query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: REFUSED['bad-target'] })
  const result = await deleteColumn(columnId, requireUser(event).id, parsed.data.moveTo)
  if (!result) throw columnNotFound()
  if (result !== 'deleted') throw createError({ statusCode: 400, statusMessage: REFUSED[result] })
  setResponseStatus(event, 204)
  return null
})
