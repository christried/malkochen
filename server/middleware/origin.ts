import { parseServerEnv } from '../env'

// Refuses writes to /api/** from any origin but the app's own (#193).
// SameSite=Lax on the session cookie only separates sites, and every
// *.christried.me subdomain is the same site. Better Auth checks Origin on its
// own routes, so /api/auth/** is left to it.
// Without Origin, Sec-Fetch-Site decides. A browser sends at least one of the
// two on every write, so a request with neither isn't a forged one from a
// page (the API tests, curl, server-side rendering's in-process calls) and is
// let through.
const APP_ORIGIN = new URL(parseServerEnv(process.env).BETTER_AUTH_URL).origin
const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  if (READS.has(event.method)) return
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || /^\/api\/auth(\/|$)/.test(path)) return

  const origin = getRequestHeader(event, 'origin')
  const fetchSite = getRequestHeader(event, 'sec-fetch-site')
  const sameOrigin = origin !== undefined ? origin === APP_ORIGIN : fetchSite === undefined || fetchSite === 'same-origin'
  if (!sameOrigin) throw createError({ statusCode: 403, statusMessage: 'Cross-origin write refused' })
})
