import { z } from 'zod'
import type { AdminBoard } from '../../../shared/admin'
import { adminBoards } from '../../utils/admin'
import { requireOperator } from '../../utils/operator'

const query = z.object({ q: z.string().max(100).default('') })

// GET /api/admin/boards?q= — every Board for the Admin Page (#397), for the
// Operator only: "not found" to anyone else. `q` filters by Board name or
// Owner's Username.
export default defineEventHandler((event): Promise<AdminBoard[]> => {
  requireOperator(event)
  const parsed = query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'The search is too long' })
  return adminBoards(parsed.data.q)
})
