import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxtjs/google-fonts'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'malkochen',
      // Installable (PRD story 7): the manifest and icons are the handoff's
      // assets/icon/. Android builds its splash from the manifest; iOS shows
      // the background colour until the app has drawn. The manifest's
      // background_color is butter (#FCD980), not the Board's: the native
      // splash must match the first frame of the web splash that follows it
      // (SplashScreen.vue, frame 10), or the launch flashes between the two.
      // theme_color stays #131211.
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
    },
  },
  // tokens.json → font.load: Newsreader (opsz, 400/500, italic 400) and
  // Hanken Grotesk (400–700). Downloaded at build time and self-hosted.
  googleFonts: {
    families: {
      'Newsreader': { wght: [400, 500], ital: [400] },
      'Hanken Grotesk': [400, 500, 600, 700],
    },
    display: 'swap',
    download: true,
  },
  // `nuxt typecheck` also covers the tests and the root tool configs.
  typescript: {
    nodeTsConfig: {
      include: ['../tests/**/*', '../*.config.ts'],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
