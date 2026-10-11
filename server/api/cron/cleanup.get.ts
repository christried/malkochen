import { createHash, timingSafeEqual } from 'node:crypto'
import { parseServerEnv } from '../../env'
import { cleanUp } from '../../utils/cleanup'

// GET /api/cron/cleanup — the daily cleanup job (server/utils/cleanup.ts),
// called by Vercel Cron (vercel.json) with `Authorization: Bearer
// <CRON_SECRET>`. Needs no session (server/middleware/auth.ts lets it
// through); anything without the secret is refused, and with no secret set
// the job never runs.
const { CRON_SECRET } = parseServerEnv(process.env)

// Compared as hashes, so the comparison takes as long whatever was sent.
const digest = (value: string) => createHash('sha256').update(value).digest()

function sentTheSecret(authorization: string | undefined): boolean {
  return CRON_SECRET !== '' && timingSafeEqual(digest(authorization ?? ''), digest(`Bearer ${CRON_SECRET}`))
}

export default defineEventHandler(async (event) => {
  if (!sentTheSecret(getRequestHeader(event, 'authorization'))) throw createError({ statusCode: 401, statusMessage: 'Not the cron job' })
  const report = await cleanUp()
  console.info(`[cleanup] purged ${report.purgedDishes} Dishes and ${report.purgedCookings} Cookings, deleted ${report.deletedImages} images`)
  return report
})
