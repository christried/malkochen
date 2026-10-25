import { parseServerEnv } from '../env'
import { webAppManifest } from '../../shared/web-app-manifest'
import { isStaging } from '../../shared/staging'

const { VERCEL_ENV } = parseServerEnv(process.env)

// GET /manifest.webmanifest: the web app manifest (#414). Served by the server
// rather than from public/, so Staging can say it is Staging: "malkochen
// Staging" under its own name on the home screen. Production's fields are the
// ones public/manifest.webmanifest had. Its answer matches that file's: the
// same type, and no caching (max-age=0). Staging's X-Robots-Tag comes from
// routeRules (nuxt.config.ts), as for every other answer.
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'content-type': 'application/manifest+json; charset=utf-8',
    'cache-control': 'public, max-age=0, must-revalidate',
  })
  return JSON.stringify(webAppManifest(isStaging(VERCEL_ENV)))
})
