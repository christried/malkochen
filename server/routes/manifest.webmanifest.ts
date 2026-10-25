import { isStaging } from '../../shared/staging'
import { webAppManifest } from '../../shared/web-app-manifest'

// GET /manifest.webmanifest: the web app manifest (#414). Served by the server
// rather than from public/, so Staging can say it is Staging: "malkochen
// Staging" under its own name on the home screen. Production's is the same
// file as before.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'content-type', 'application/manifest+json')
  return webAppManifest(isStaging(process.env.VERCEL_ENV))
})
