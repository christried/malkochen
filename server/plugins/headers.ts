import { randomBytes } from 'node:crypto'
import { VIDEO_PLAYER_ORIGINS } from '../../shared/video-embed'
import { CSP_REPORT_PATH } from '../utils/csp-report'

// The Content Security Policy of a page, naming the nonce its inline scripts
// carry. default-src covers what isn't listed: the fonts, the service worker
// and the manifest all come from the app's own origin.
function contentSecurityPolicy(nonce: string): string {
  return [
    'default-src \'self\'',
    `script-src 'self' 'nonce-${nonce}'`,
    // Inline styles are allowed: Vue renders bound styles as style
    // attributes, which a nonce can't cover.
    'style-src \'self\' \'unsafe-inline\'',
    // Any https: Add Dish shows the Source image straight from the platform
    // before saving; stored images are on the Blob store, Google's Profile
    // Pictures on Google's.
    'img-src \'self\' https:',
    'media-src \'self\'',
    'connect-src \'self\'',
    // Click-to-play video in the Dish detail (#221, shared/
    // video-embed.ts): the embedded players of TikTok, YouTube (its no-cookie
    // domain) and Instagram. No other frame, not even the app's own.
    `frame-src ${Object.values(VIDEO_PLAYER_ORIGINS).join(' ')}`,
    'form-action \'self\' https://accounts.google.com',
    'base-uri \'self\'',
    'object-src \'none\'',
    // Where the browser reports what broke the policy
    // (server/api/csp-report.post.ts): report-to, today's way, names the
    // endpoint of the Reporting-Endpoints header; report-uri is the one
    // browsers without it know.
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${REPORTING_ENDPOINT}`,
  ].join('; ')
}

const REPORTING_ENDPOINT = 'csp'


// What a rendered page's answer carries beyond nuxt.config.ts's routeRules
// (#192).
export default defineNitroPlugin((nitro) => {
  // Report-only for now: the browser reports what would be blocked and blocks
  // nothing. To be enforced once the reports have stayed away in production
  // (Vercel's logs, "[csp-report]").
  // public/offline.html has an inline script and style of its own and gets no
  // report-only policy: it shows only when malkochen can't be reached, so its
  // reports would have nowhere to go. Its policy comes with enforcing, as
  // hashes: a static file can't carry a nonce.
  nitro.hooks.hook('render:html', (html, { event }) => {
    // In dev Nuxt wraps the error screen in its own error page, which has
    // inline scripts and a frame of its own.
    if (import.meta.dev && event.path.startsWith('/__nuxt_error')) return
    const nonce = randomBytes(16).toString('base64')
    // Nuxt's own inline scripts (the runtime config) and the splash's
    // (SplashScreen.vue). Never html.body: that is the rendered app, and a
    // script that got in there is what the policy is for. What people type
    // reaches the other parts escaped only: a Dish title in <title>, the
    // payload as JSON.
    const withNonce = (chunk: string) => chunk.replace(/<script(?=[\s>])/g, `<script nonce="${nonce}"`)
    html.head = html.head.map(withNonce)
    html.bodyPrepend = html.bodyPrepend.map(withNonce)
    html.bodyAppend = html.bodyAppend.map(withNonce)
    setResponseHeader(event, 'Content-Security-Policy-Report-Only', contentSecurityPolicy(nonce))
    setResponseHeader(event, 'Reporting-Endpoints', `${REPORTING_ENDPOINT}="${CSP_REPORT_PATH}"`)
  })

  nitro.hooks.hook('render:response', (response) => {
    const headers = response.headers ??= {}
    // Nuxt's renderer names itself on every page.
    delete headers['x-powered-by']
    // A page can hold a signed-in user's Board. Set here and not by a route
    // rule: '/**' would take the caching from the files in public/ too.
    headers['cache-control'] = 'private, no-store'
  })
})
