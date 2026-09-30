import { allowlistRefusal, auth } from '../utils/auth'

// The security boundary for /api/**: every route needs a session, except
// Better Auth's own and the health check. Page navigation is guarded
// separately by app/middleware/auth.global.ts.
const PUBLIC_API = [/^\/api\/auth(\/|$)/, /^\/api\/health$/]

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || PUBLIC_API.some(p => p.test(path))) return

  // event.headers, never toWebRequest(event): building a Request locks the
  // body stream, and every POST/PATCH handler after this would hang.
  const session = await auth.api.getSession({ headers: event.headers }).catch(() => null)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })

  // Someone taken off the Allowlist loses access even with a live session.
  if (allowlistRefusal(session.user.email)) {
    throw createError({ statusCode: 403, statusMessage: 'Not on the Allowlist' })
  }
  event.context.user = session.user
})
