import { violationsIn } from '../utils/csp-report'

// POST /api/csp-report — where a browser reports what broke a page's
// report-only Content Security Policy (server/plugins/headers.ts, #247).
// Each violation becomes one line in the server log, which on Vercel is
// where to see whether the policy runs clean; nothing is stored. Needs no
// session (server/middleware/auth.ts): /login has a policy too. A browser
// reports from the page's own origin, so the report passes
// server/middleware/origin.ts like any write of the app's.
// It always answers 204, whatever was sent: a browser does nothing with the
// answer, and anyone else learns nothing from it. Not logged: a body over
// the size limit or without a Content-Length, anything that isn't a report,
// and what one IP address sends over its limit (server/rate-limits.ts).
const MAX_BYTES = 16 * 1024

export default defineEventHandler(async (event) => {
  setResponseStatus(event, 204)
  const length = getRequestHeader(event, 'content-length') ?? ''
  if (!/^\d+$/.test(length) || Number(length) > MAX_BYTES) return null
  // A limit that can't be counted (the database is away) drops the report too.
  if (!await withinClientLimit(event, 'csp-report').catch(() => false)) return null

  const contentType = (getRequestHeader(event, 'content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  // As JSON, so nothing a report says can start a log line of its own.
  for (const found of violationsIn(contentType, await readRawBody(event) ?? '')) console.warn(`[csp-report] ${JSON.stringify(found)}`)
  return null
})
