import { expect, test } from 'vitest'
import { isStaging, stagingHeaders } from '../../shared/staging'
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

test('given Preview, noindex is due', () => {
  expect(stagingHeaders('preview')).toEqual({ 'X-Robots-Tag': 'noindex' })
})

test.each(['production', undefined])('given %s, noindex is not due', (vercelEnv) => {
  expect(stagingHeaders(vercelEnv)).toEqual({})
})

test('Staging\'s manifest is production\'s, renamed to "malkochen Staging" with the short name "Staging"', () => {
  expect(webAppManifest(true)).toEqual({ ...webAppManifest(false), name: 'malkochen Staging', short_name: 'Staging' })
})
