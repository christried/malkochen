import { cleanUp } from '../../utils/cleanup'
import { requireCronSecret } from '../../utils/cron'

// GET /api/cron/cleanup — the daily cleanup job (server/utils/cleanup.ts),
// called by Vercel Cron (vercel.json) with CRON_SECRET (server/utils/cron.ts).
export default defineEventHandler(async (event) => {
  requireCronSecret(event)
  const report = await cleanUp()
  console.info(`[cleanup] purged ${report.purgedBoards} Boards, ${report.purgedDishes} Dishes, ${report.purgedCookings} Cookings and ${report.purgedComments} Comments, deleted ${report.deletedImages} images`)
  return report
})
