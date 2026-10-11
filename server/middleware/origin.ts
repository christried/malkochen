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

function fromOwnOriginOrNoBrowser(origin: string | undefined, fetchSite: string | undefined): boolean {
  if (origin !== undefined) return origin === APP_ORIGIN
  return fetchSite === undefined || fetchSite === 'same-origin'
}

export default defineEventHandler((event) => {
  if (READS.has(event.method)) return
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || /^\/api\/auth(\/|$)/.test(path)) return

  if (!fromOwnOriginOrNoBrowser(getRequestHeader(event, 'origin'), getRequestHeader(event, 'sec-fetch-site'))) throw createError({ statusCode: 403, statusMessage: 'Cross-origin write refused' })
})
