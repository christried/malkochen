import { requireCronSecret } from '../../utils/cron'
import { fillSourceFacts, logSourceFacts } from '../../utils/source-facts-fill'

// GET /api/cron/source-facts: the Captions and playable videos backfill
// (server/utils/source-facts-fill.ts) on its own, so the Operator can push it
// along after a deploy: curl -H "Authorization: Bearer $CRON_SECRET" <url>.
// Not in vercel.json: the daily cleanup job runs it too.
export default defineEventHandler(async (event) => {
  requireCronSecret(event)
  const report = await fillSourceFacts()
  logSourceFacts(report)
  return report
})
