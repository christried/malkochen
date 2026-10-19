import { createHash } from 'node:crypto'
import { expect, test } from 'vitest'
import { ALLOWLISTED, anonymous, signIn } from './client'

// The headers every answer carries (#192): the second line of defence behind
// Vue's escaping and the SameSite=Lax session cookie.
// Shafi is used by this file only.

const shafi = () => signIn(ALLOWLISTED[41])

// A page, an API answer, a file from public/, and the Offline page, which
// has a policy of its own.
const ANSWERS = ['/login', '/api/health', '/icons/icon.svg', '/offline.html']

test.each(ANSWERS)('%s can\'t be framed, isn\'t sniffed, and doesn\'t name the framework', async (path) => {
  const res = await anonymous().fetch(path)

  expect(res.status).toBe(200)
  expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
  expect(res.headers.get('x-frame-options')).toBe('DENY')
  expect(res.headers.get('content-security-policy')?.split('; ')).toContain('frame-ancestors \'none\'')
  expect(res.headers.get('x-powered-by')).toBeNull()
})

test.each(['/api/health', '/icons/icon.svg'])('%s, which is no page, has no policy beyond not being framed', async (path) => {
  const res = await anonymous().fetch(path)

  expect(res.headers.get('content-security-policy')).toBe('frame-ancestors \'none\'')
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

// The policy of a page and the nonce it names.
async function policyOf(path: string) {
  const res = await anonymous().fetch(path)
  const policy = res.headers.get('content-security-policy') ?? ''
  return {
    policy,
    nonce: policy.match(/'nonce-([^']+)'/)?.[1],
    html: await res.text(),
    reportOnly: res.headers.get('content-security-policy-report-only'),
  }
}

test('a page enforces its Content Security Policy, and reports what breaks it', async () => {
  const { policy, nonce, reportOnly } = await policyOf('/login')

  expect(reportOnly).toBeNull()
  expect(policy.split('; ')).toEqual([
    'default-src \'self\'',
    `script-src 'self' 'nonce-${nonce}'`,
    'style-src \'self\' \'unsafe-inline\'',
    'img-src \'self\' https:',
    'media-src \'self\'',
    'connect-src \'self\'',
    // Click-to-play video (#221): the embedded players of TikTok, YouTube
    // (its no-cookie domain) and Instagram, and no other frame at all.
    'frame-src https://www.tiktok.com https://www.youtube-nocookie.com https://www.instagram.com',
    'form-action \'self\' https://accounts.google.com',
    'base-uri \'self\'',
    'object-src \'none\'',
    // As every answer (nuxt.config.ts): a page's policy takes that one's
    // place.
    'frame-ancestors \'none\'',
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

// How a policy names an inline script or style by its content.
const hashOf = (content: string) => `'sha256-${createHash('sha256').update(content, 'utf8').digest('base64')}'`

// public/offline.html is a static file, so it can't carry a nonce: its policy
// names its inline scripts and its style by their hashes. It reports nothing:
// it shows when malkochen can't be reached, so there is nowhere to report to.
test('the Offline page enforces a policy of its own, naming its inline scripts and style by their hashes', async () => {
  const res = await anonymous().fetch('/offline.html')
  const html = await res.text()
  const policy = res.headers.get('content-security-policy') ?? ''

  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(found => hashOf(found[1]!))
  const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(found => hashOf(found[1]!))
  expect(scripts).toHaveLength(2)
  expect(styles).toHaveLength(1)
  expect(policy.split('; ')).toEqual([
    'default-src \'self\'',
    `script-src ${scripts.join(' ')}`,
    `style-src ${styles.join(' ')}`,
    'form-action \'none\'',
    'base-uri \'none\'',
    'object-src \'none\'',
    'frame-ancestors \'none\'',
  ])
  expect(res.headers.get('content-security-policy-report-only')).toBeNull()
})

// A hash allows an inline <script>, never an onclick="…".
test('the Offline page has no inline event handlers', async () => {
  const html = await (await anonymous().fetch('/offline.html')).text()

  expect(html).not.toMatch(/<[^>]*\son[a-z]+=/i)
})
