// The web app manifest (#414): production's is the one it has always been,
// Staging's is renamed so the home screen tells the two apart. Served by
// server/routes/manifest.webmanifest.ts, which picks the variant at runtime.

const PRODUCTION = {
  name: 'malkochen',
  short_name: 'malkochen',
  description: 'Collect dishes. Cook together.',
  lang: 'en',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: '#FCD980',
  theme_color: '#FCD980',
  share_target: {
    action: '/share',
    method: 'GET',
    params: {
      title: 'title',
      text: 'text',
      url: 'url',
    },
  },
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-monochrome.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'monochrome' },
    { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
}

export function webAppManifest(staging: boolean) {
  if (!staging) return PRODUCTION
  return { ...PRODUCTION, name: 'malkochen Staging', short_name: 'Staging' }
}
