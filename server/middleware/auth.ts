import { chooseLanguage } from '../../shared/language'
import { auth, signInRefusal } from '../utils/auth'
import { recordBrowserLanguage } from '../utils/people'

// The security boundary for /api/**: every route needs a session, except
// Better Auth's own, the health check, and what the invite landing and "Not
// unlocked" need before sign-in (seeing an invite, remembering it, the one
// remembered), the cron jobs, which check CRON_SECRET themselves, and a
// browser's report of what broke a page's Content Security Policy (/login
// has one too).
// Page navigation is guarded separately by app/middleware/auth.global.ts.
const PUBLIC_API = [/^\/api\/auth(\/|$)/, /^\/api\/health$/, /^\/api\/invites\/pending$/, /^\/api\/invites\/[^/]+(\/remember)?$/, /^\/api\/cron\//, /^\/api\/csp-report$/]
const BEFORE_USERNAME = [/^\/api\/me(\/username)?$/, /^\/api\/invites\//]

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

  // A new user picks their Username before anything else (#209): until then
  // only who they are, setting it, and following an Invite Link (which the
  // sign-in itself does too, server/utils/auth.ts) are open to them.
  if (!session.user.username && !BEFORE_USERNAME.some(p => p.test(path))) {
    throw createError({ statusCode: 403, statusMessage: 'No Username yet' })
  }
  event.context.user = session.user

  // The language their browser asks for, kept for when they aren't there to
  // ask (#328). Written only when it changed.
  const asked = getRequestHeader(event, 'accept-language')
  const browserLanguage = asked ? chooseLanguage('auto', asked) : null
  if (browserLanguage && browserLanguage !== session.user.browserLanguage) await recordBrowserLanguage(session.user.id, browserLanguage)
})
