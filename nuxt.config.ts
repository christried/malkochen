import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import { offlinePagePolicy } from './server/offline-page-policy'

const EVERYWHERE = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Both keep other sites from framing the app: frame-ancestors is today's
  // way, X-Frame-Options the one older browsers know.
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': 'frame-ancestors \'none\'',
}

// The Offline page's headers: every answer's, with a policy of its own in
// place of that one (#344), hashed from the page as it is built.
const OFFLINE_PAGE = {
  ...EVERYWHERE,
  'Content-Security-Policy': offlinePagePolicy(readFileSync(new URL('public/offline.html', import.meta.url), 'utf8')),
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // Off: DevTools pulls in simple-git 3 (critical advisories, #198) and
  // isn't installed (pnpm-workspace.yaml overrides).
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@nuxt/fonts'],
  css: ['~/assets/css/main.css', '~/assets/css/loops.css'],
  app: {
    head: {
      title: 'malkochen',
      // Installable (PRD story 7): the manifest and icons are the handoff's
      // assets/icon/. Android builds its splash from the manifest; iOS shows
      // the background colour until the app has drawn. The manifest's
      // background_color is butter (#FCD980), not the Board's: the native
      // splash must match the first frame of the web splash that follows it
      // (SplashScreen.vue, frame 10), or the launch flashes between the two.
      // theme_color is butter too: on Android 15+ the navigation bar shows
      // background_color, and Chrome picks its icon contrast from theme_color,
      // so butter gives dark icons on the butter bar
      // (docs/research/android-nav-bar-and-share-sheet.md, option 1).
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/icon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/icons/favicon-48.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icons/favicon-16.png' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon-180.png' },
      ],
      // The status bar takes the Board's background (tokens.css --color-bg).
      meta: [
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#F7F6F2' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#131211' },
        { name: 'apple-mobile-web-app-title', content: 'malkochen' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
      ],
      // The browser's offer to install malkochen, kept from the first moment
      // for the Tour's last step (useInstallPrompt): it can come before the
      // app's own code has loaded. Given the CSP's nonce like every inline
      // script in the head (server/plugins/headers.ts).
      script: [{
        key: 'install-prompt',
        tagPriority: 'critical',
        innerHTML: 'addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e})',
      }],
    },
  },
  // tokens.json → font.load: Petrona (display) and Figtree (UI), both
  // variable with italics, latin + latin-ext (ä ö ü ß, à è é ì ò ù).
  // Downloaded at build time and self-hosted. The tokens name the fonts
  // through CSS variables (--font-display, --font-ui), so those are scanned
  // too: that's where the size-adjusted fallback faces are added, which keep
  // the text from jumping when the font arrives (font-display: swap).
  // In a build the @font-face rules aren't in the CSS files: @nuxt/fonts 1
  // puts them in an inline <style> in each rendered page's <head>, and the
  // files under /_nuxt/fonts/ (#244). In dev they stay in the CSS.
  fonts: {
    families: [
      { name: 'Petrona', weights: ['100 900'], styles: ['normal', 'italic'], subsets: ['latin', 'latin-ext'], fallbacks: ['Georgia', 'Noto Serif'] },
      { name: 'Figtree', weights: ['300 900'], styles: ['normal', 'italic'], subsets: ['latin', 'latin-ext'], fallbacks: ['Roboto', 'Arial'] },
    ],
    // From Google Fonts. Not named on each family: Google then picks the
    // fallbacks itself (the generic "serif"), not the ones above.
    priority: ['google'],
    // Only the --font* variables: `true` reads every custom property as a
    // font name, and since Nuxt 4.6 its CSS minifier hands it a calc() (for
    // --height-empty-column, main.css) to look up as one (#243).
    processCSSVariables: 'font-prefixed-only',
  },
  runtimeConfig: {
    public: {
      // Push notifications (#219): the VAPID public key a device subscribes
      // with (server/env.ts). Empty: the settings offer no push
      // notifications.
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
      // The Email Digest (#220): whether the server has a Resend API key
      // (RESEND_API_KEY, server/env.ts) to send it with. The key itself
      // never leaves the server. False: the settings offer no digest.
      emailDigest: Boolean(process.env.RESEND_API_KEY),
      // The browser tests' dev server (tests/e2e/run.ts). Only there may a
      // test page shorten the Board's poll (composables/useBoardSync.ts).
      e2e: Boolean(process.env.MALKOCHEN_E2E),
    },
  },
  // `nuxt typecheck` also covers the tests and the root tool configs.
  typescript: {
    nodeTsConfig: {
      include: ['../tests/**/*', '../*.config.ts'],
    },
  },
  // Headers for every answer, files from public/ included (#192). What only
  // a rendered page gets (its own Cache-Control, the nonce'd CSP) is set in
  // server/plugins/headers.ts.
  routeRules: {
    // The Offline page enforces a policy of its own (#344), with hashes in
    // place of a nonce. Before '/**' and with all of its headers: Vercel
    // applies the first rule that matches a file, and orders rules of the
    // same depth as they are written here.
    '/offline.html': { headers: OFFLINE_PAGE },
    '/**': { headers: EVERYWHERE },
    // Named again for the built files: Nitro gives them a caching rule of
    // their own, and for a file Vercel applies the first rule that matches,
    // not all of them.
    '/_nuxt/**': { headers: EVERYWHERE },
    // Boards, Dishes and /api/me (with the email address) belong in no
    // cache. Unset, Vercel answers "public, max-age=0, must-revalidate".
    '/api/**': { headers: { 'Cache-Control': 'private, no-store' } },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  hooks: {
    // Nuxt 4.6's dev error overlay (#243) shows a client error on every page
    // open on the dev server until it is cleared, with an <h1>, a <main> and
    // inline scripts of its own. The browser tests run against `pnpm dev` and
    // cause errors on purpose (error-screen.spec.ts), so later tests' pages
    // would carry it. Nuxt has no option to turn it off: the browser tests
    // leave its client plugin out. Their own assertions still see each error.
    'app:resolve'(app) {
      if (!process.env.MALKOCHEN_E2E) return
      const devErrorOverlay = /[\\/]dev-error-overlay\.client(\.[jt]s)?$/
      app.plugins = app.plugins.filter(plugin => !devErrorOverlay.test(plugin.src))
    },
  },
})
