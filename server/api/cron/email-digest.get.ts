import { requireCronSecret } from '../../utils/cron'
import { sendDigests } from '../../utils/email-digest'

// GET /api/cron/email-digest — the daily Email Digest (#220,
// server/utils/email-digest.ts), called by Vercel Cron at 16:00 UTC
// (vercel.json) with CRON_SECRET (server/utils/cron.ts).
export default defineEventHandler(async (event) => {
  requireCronSecret(event)
  const report = await sendDigests()
  console.info(`[email-digest] ${report.sent} sent, ${report.failed} not sent, of ${report.covered} switched on`)
  return report
})
