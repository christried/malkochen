import { expect, test } from 'vitest'
import { anonymous } from './client'

// The web app manifest, served at the same address with the same type and
// the same fields as before Staging (#414). The test server never runs as
// Preview, so this pins down production's answer.

// The manifest as it was in public/manifest.webmanifest, copied here as a
// known-good literal.
const PRODUCTION_MANIFEST = {
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
    params: { title: 'title', text: 'text', url: 'url' },
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

test('the manifest is served at its address, as a web app manifest, named malkochen', async () => {
  const res = await anonymous().fetch('/manifest.webmanifest')

  expect(res.status).toBe(200)
  expect(res.headers.get('content-type')).toBe('application/manifest+json; charset=utf-8')
  expect(res.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate')
  expect(await res.json()).toEqual(PRODUCTION_MANIFEST)
})

test('the manifest carries no X-Robots-Tag: production is not Staging', async () => {
  const res = await anonymous().fetch('/manifest.webmanifest')

  expect(res.headers.get('x-robots-tag')).toBeNull()
})
