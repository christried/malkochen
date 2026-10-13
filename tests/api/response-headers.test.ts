import { expect, test } from 'vitest'
import { ALLOWLISTED, anonymous, signIn } from './client'

// The headers every answer carries (#192): the second line of defence behind
// Vue's escaping and the SameSite=Lax session cookie.
// Shafi is used by this file only.

const shafi = () => signIn(ALLOWLISTED[41])

// A page, an API answer, and a file from public/.
const ANSWERS = ['/login', '/api/health', '/icons/icon.svg']

test.each(ANSWERS)('%s can\'t be framed, isn\'t sniffed, and doesn\'t name the framework', async (path) => {
  const res = await anonymous().fetch(path)

  expect(res.status).toBe(200)
  expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  expect(res.headers.get('x-frame-options')).toBe('DENY')
  expect(res.headers.get('content-security-policy')).toBe('frame-ancestors \'none\'')
  expect(res.headers.get('x-powered-by')).toBeNull()
})

test.each(['/login', '/no-such-page'])('the page %s is stored by no cache', async (path) => {
  const res = await anonymous().fetch(path)

  expect(res.headers.get('content-type')).toContain('text/html')
  expect(res.headers.get('cache-control')).toBe('private, no-store')
})

test('an API answer is stored by no cache, a refusal included', async () => {
  const boards = await (await shafi()).fetch('/api/boards')
  const refused = await anonymous().fetch('/api/boards')

  expect(boards.status).toBe(200)
  expect(boards.headers.get('cache-control')).toBe('private, no-store')
  expect(refused.status).toBe(401)
  expect(refused.headers.get('cache-control')).toBe('private, no-store')
})

test('the app\'s own files keep their caching', async () => {
  const page = await (await anonymous().fetch('/login')).text()
  const script = page.match(/\/_nuxt\/[^"]+\.js/)![0]

  const hashed = await anonymous().fetch(script)
  const icon = await anonymous().fetch('/icons/icon.svg')

  expect(hashed.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  expect(icon.headers.get('cache-control')).toBeNull()
})

// The report-only policy of a page and the nonce it names.
async function policyOf(path: string) {
  const res = await anonymous().fetch(path)
  const policy = res.headers.get('content-security-policy-report-only') ?? ''
  return { policy, nonce: policy.match(/'nonce-([^']+)'/)?.[1], html: await res.text() }
}

test('a page reports what breaks its Content Security Policy, without enforcing it yet', async () => {
  const { policy, nonce } = await policyOf('/login')

  expect(policy.split('; ')).toEqual([
    'default-src \'self\'',
    `script-src 'self' 'nonce-${nonce}'`,
    'style-src \'self\' \'unsafe-inline\'',
    'img-src \'self\' https:',
    'media-src \'self\'',
    'connect-src \'self\'',
    'form-action \'self\' https://accounts.google.com',
    'base-uri \'self\'',
    'object-src \'none\'',
    'report-uri /api/csp-report',
    'report-to csp',
  ])
})

// tests/api/csp-report.test.ts covers the endpoint itself.
test('a page names where the browser reports what breaks its policy', async () => {
  const res = await anonymous().fetch('/login')

  expect(res.headers.get('reporting-endpoints')).toBe('csp="/api/csp-report"')
})

// The error screen too: in production it is a page like any other.
test.each(['/login', '/no-such-page'])('every inline script of %s carries the policy\'s nonce, new on each answer', async (path) => {
  const { nonce, html } = await policyOf(path)
  const again = await policyOf(path)

  const inline = [...html.matchAll(/<script\b[^>]*>/g)].map(tag => tag[0]).filter(tag => !/\bsrc=|type="application\/json"/.test(tag))
  expect(inline.length).toBeGreaterThan(0)
  for (const tag of inline) expect(tag).toContain(`nonce="${nonce}"`)
  expect(nonce).toMatch(/^[\w+/]{22}==$/)
  expect(again.nonce).not.toBe(nonce)
})
