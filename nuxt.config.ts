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
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/icon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon-180.png' },
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
