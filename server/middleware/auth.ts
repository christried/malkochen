import { auth, signInRefusal } from '../utils/auth'

// The security boundary for /api/**: every route needs a session, except
// Better Auth's own, the health check, and what the invite landing and "Not
// unlocked" need before sign-in (seeing an invite, remembering it, the one
// remembered), the cron jobs, which check CRON_SECRET themselves, and a
// browser's report of what broke a page's Content Security Policy (/login
// has one too).
// Page navigation is guarded separately by app/middleware/auth.global.ts.
const PUBLIC_API = [/^\/api\/auth(\/|$)/, /^\/api\/health$/, /^\/api\/invites\/pending$/, /^\/api\/invites\/[^/]+(\/remember)?$/, /^\/api\/cron\//, /^\/api\/csp-report$/]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || PUBLIC_API.some(p => p.test(path))) return

  // event.headers, never toWebRequest(event): building a Request locks the
  // body stream, and every POST/PATCH handler after this would hang.
  const session = await auth.api.getSession({ headers: event.headers }).catch(() => null)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })

  // Someone taken off the Allowlist loses access even with a live session; so
  // does a session made before unverified emails were refused (#191).
  const refusal = signInRefusal(session.user)
  if (refusal) throw createError({ statusCode: 403, statusMessage: refusal.errorDescription })
  event.context.user = session.user
})
