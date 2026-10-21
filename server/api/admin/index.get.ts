import type { AdminFigures } from '../../../shared/admin'
import { adminFigures } from '../../utils/admin'
import { requireOperator } from '../../utils/operator'

// GET /api/admin — the Admin Page's figures (#348), for the Operator only:
// "not found" to anyone else.
export default defineEventHandler((event): Promise<AdminFigures> => {
  requireOperator(event)
  return adminFigures()
})
