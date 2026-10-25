import { expect, test } from 'vitest'
import { isStaging } from '../../shared/staging'
import { webAppManifest } from '../../shared/web-app-manifest'

// Staging (CONTEXT.md): wherever Vercel runs the app as Preview. Local dev,
// the test runs and production are never Staging, so they show no label, get
// no noindex and keep the manifest's name.

test.each([
  ['preview', true],
  ['production', false],
  ['development', false],
  ['', false],
  [undefined, false],
])('VERCEL_ENV %s makes Staging: %s', (vercelEnv, staging) => {
  expect(isStaging(vercelEnv)).toBe(staging)
})

// The manifest as public/manifest.webmanifest had it before Staging (#414):
// production's answer must keep every field of it.
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

test('production\'s manifest is unchanged in every field', () => {
  expect(webAppManifest(false)).toEqual(PRODUCTION_MANIFEST)
})

test('Staging\'s manifest is named "malkochen Staging", with a short name that reads as Staging', () => {
  const manifest = webAppManifest(true)

  expect(manifest.name).toBe('malkochen Staging')
  expect(manifest.short_name).toBe('Staging')
  expect(manifest).toEqual({ ...PRODUCTION_MANIFEST, name: 'malkochen Staging', short_name: 'Staging' })
})
