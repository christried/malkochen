import { z } from 'zod'
import { EVENT_KINDS } from '../../../shared/event-kinds'
import type { AdminEventPage } from '../../../shared/admin'
import { adminEvents } from '../../utils/admin-events'
import { requireOperator } from '../../utils/operator'

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))

const query = z.object({
  user: z.string().max(100).optional(),
  board: z.string().uuid().optional(),
  kinds: z.string().max(2000).transform(value => value.split(',').filter(Boolean)).pipe(z.array(z.enum(EVENT_KINDS))).optional(),
  from: day.optional(),
  to: day.optional(),
  before: z.coerce.number().int().positive().optional(),
})

// GET /api/admin/events: a page of the Event Log for the Admin Page (#400),
// for the Operator only: "not found" to anyone else. Newest first; `before`
// is the `next` of the page before.
export default defineEventHandler((event): Promise<AdminEventPage> => {
  requireOperator(event)
  const parsed = query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'These filters are not valid' })
  return adminEvents(parsed.data)
})
