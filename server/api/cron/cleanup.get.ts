import { cleanUp } from '../../utils/cleanup'
import { requireCronSecret } from '../../utils/cron'
import { fillSourceFacts, logSourceFacts } from '../../utils/source-facts-fill'

// GET /api/cron/cleanup — the daily cleanup job (server/utils/cleanup.ts),
// called by Vercel Cron (vercel.json) with CRON_SECRET (server/utils/cron.ts).
// It also runs the Captions and playable videos backfill for a while
// (server/utils/source-facts-fill.ts); a failure there is logged, not answered.
export default defineEventHandler(async (event) => {
  requireCronSecret(event)
  const report = await cleanUp()
  console.info(`[cleanup] purged ${report.purgedBoards} Boards, ${report.purgedDishes} Dishes, ${report.purgedCookings} Cookings and ${report.purgedComments} Comments, deleted ${report.deletedImages} images`)
  try {
    logSourceFacts(await fillSourceFacts())
  }
  catch (err) {
    console.warn('[source-facts] failed', err)
  }
  return report
})
