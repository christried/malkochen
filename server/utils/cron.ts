import { createHash, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { parseServerEnv } from '../env'

// The daily jobs under /api/cron/ (vercel.json) are called by Vercel Cron
// with `Authorization: Bearer <CRON_SECRET>`. They need no session
// (server/middleware/auth.ts lets them through); anything without the
// secret is refused, and with no secret set they never run.
const { CRON_SECRET } = parseServerEnv(process.env)

// Compared as hashes, so the comparison takes as long whatever was sent.
const sha256 = (value: string) => createHash('sha256').update(value).digest()

export function requireCronSecret(event: H3Event): void {
  const authorization = getRequestHeader(event, 'authorization') ?? ''
  const sent = CRON_SECRET !== '' && timingSafeEqual(sha256(authorization), sha256(`Bearer ${CRON_SECRET}`))
  if (!sent) throw createError({ statusCode: 401, statusMessage: 'Not the cron job' })
}
