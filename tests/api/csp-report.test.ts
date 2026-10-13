import { readFile } from 'node:fs/promises'
import { expect, inject, test } from 'vitest'
import { ADDRESS_RATE_LIMITS } from '../../server/rate-limits'
import { anonymous } from './client'
import { SERVER_LOG } from './server-env'
import { endAddressLimitWindow, useUpAddressLimit } from './time-travel'

// POST /api/csp-report (#247): where a browser reports what broke a page's
// report-only Content Security Policy (server/plugins/headers.ts). Each
// report becomes one line in the server log and nothing else. Nobody is
// signed in here: a violation on /login comes from someone who isn't.
// Every test reports from an address of its own (x-forwarded-for, as Vercel
// sets it), so one test's reports never count towards another's limit.

const REPORT_URI = 'application/csp-report'
const REPORTING_API = 'application/reports+json'

let addresses = 0
const newAddress = () => `203.0.113.${++addresses}`

// Sends a report as a browser does: from the app's own origin.
function report(contentType: string, body: unknown, address = newAddress()) {
  return anonymous().fetch('/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': contentType, 'origin': inject('apiBaseUrl'), 'sec-fetch-site': 'same-origin', 'x-forwarded-for': address },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

// A report of an inline script on `page`, as report-uri sends it.
const inlineScriptOn = (page: string) => ({
  'csp-report': {
    'document-uri': `https://malkochen.example${page}`,
    'violated-directive': 'script-src-elem',
    'effective-directive': 'script-src-elem',
    'blocked-uri': 'inline',
    'source-file': `https://malkochen.example${page}`,
    'line-number': 12,
  },
})

const logLines = async () => (await readFile(SERVER_LOG, 'utf8')).split(/\r?\n/).filter(line => line.startsWith('[csp-report] '))

// What the endpoint logged about `page`: each line's fields. It first waits
// for the server to have written a report sent only now, so a line that is
// missing is one that was never written.
let waits = 0
async function loggedAbout(page: string): Promise<unknown[]> {
  const last = `/written-up-to-here-${++waits}`
  await report(REPORT_URI, inlineScriptOn(last))
  await expect.poll(async () => (await logLines()).some(line => line.includes(last))).toBe(true)
  return (await logLines()).filter(line => line.includes(page)).map(line => JSON.parse(line.slice('[csp-report] '.length)))
}

test('a report-uri report is answered 204 and logged as one line', async () => {
  const res = await report(REPORT_URI, {
    'csp-report': {
      'document-uri': 'https://malkochen.example/b/kochclub?suche=dal#oben',
      'referrer': '',
      'violated-directive': 'img-src',
      'effective-directive': 'img-src',
      'original-policy': 'default-src \'self\'; img-src \'self\' https:',
      'blocked-uri': 'http://bilder.example/dal.jpg',
      'source-file': 'https://malkochen.example/_nuxt/entry.js',
      'line-number': 3,
      'status-code': 200,
    },
  })

  expect(res.status).toBe(204)
  expect(await res.text()).toBe('')
  expect(await loggedAbout('/b/kochclub')).toEqual([{
    document: 'https://malkochen.example/b/kochclub',
    directive: 'img-src',
    blocked: 'http://bilder.example/dal.jpg',
    source: 'https://malkochen.example/_nuxt/entry.js',
    line: 3,
  }])
})

test('a Reporting API report is answered 204 and logged as one line', async () => {
  const res = await report(REPORTING_API, [{
    type: 'csp-violation',
    age: 12,
    url: 'https://malkochen.example/login?error=access_denied',
    user_agent: 'Mozilla/5.0',
    body: {
      documentURL: 'https://malkochen.example/login?error=access_denied',
      effectiveDirective: 'script-src-elem',
      blockedURL: 'inline',
      sourceFile: 'https://malkochen.example/login',
      lineNumber: 40,
      disposition: 'report',
      originalPolicy: 'default-src \'self\'',
    },
  }])

  expect(res.status).toBe(204)
  expect(await loggedAbout('/login')).toEqual([{
    document: 'https://malkochen.example/login',
    directive: 'script-src-elem',
    blocked: 'inline',
    source: 'https://malkochen.example/login',
    line: 40,
  }])
})

test('the Reporting API\'s reports sent together are logged one line each, other kinds left out', async () => {
  const violation = (directive: string) => ({ type: 'csp-violation', url: 'https://malkochen.example/zusammen', body: { documentURL: 'https://malkochen.example/zusammen', effectiveDirective: directive, blockedURL: 'inline' } })

  await report(REPORTING_API, [violation('script-src-elem'), { type: 'deprecation', url: 'https://malkochen.example/zusammen', body: { id: 'old' } }, violation('style-src-elem')])

  expect(await loggedAbout('/zusammen')).toEqual([
    { document: 'https://malkochen.example/zusammen', directive: 'script-src-elem', blocked: 'inline', source: null, line: null },
    { document: 'https://malkochen.example/zusammen', directive: 'style-src-elem', blocked: 'inline', source: null, line: null },
  ])
})

test('a long field is cut, and nothing a report says starts a line of its own', async () => {
  await report(REPORT_URI, {
    'csp-report': {
      'document-uri': `https://malkochen.example/lang/${'a'.repeat(500)}`,
      'effective-directive': 'img-src\n[csp-report] {"document":"/lang/forged"}',
      'blocked-uri': `https://bilder.example/${'b'.repeat(500)}`,
    },
  })

  const lines = await loggedAbout('/lang')
  expect(lines).toHaveLength(1)
  const [line] = lines as { document: string, directive: string, blocked: string }[]
  expect(line!.document).toBe(`https://malkochen.example/lang/${'a'.repeat(169)}`)
  expect(line!.directive).toBe('img-src\n[csp-report] {"document":"/lang/')
  expect(line!.blocked).toBe(`https://bilder.example/${'b'.repeat(177)}`)
})

test.each([
  ['no JSON', REPORT_URI, '{"csp-report": '],
  ['JSON that is no report', REPORT_URI, { 'document-uri': 'https://malkochen.example/kaputt' }],
  ['a report that names no directive', REPORT_URI, { 'csp-report': { 'document-uri': 'https://malkochen.example/kaputt' } }],
  ['fields that are no text', REPORTING_API, [{ type: 'csp-violation', body: { documentURL: { href: '/kaputt' }, effectiveDirective: ['/kaputt'] } }]],
  ['another content type', 'application/json', inlineScriptOn('/kaputt')],
])('a malformed report (%s) is answered 204 and not logged', async (_, contentType, body) => {
  const res = await report(contentType, body)

  expect(res.status).toBe(204)
  expect(await loggedAbout('/kaputt')).toEqual([])
})

test('an oversized report is answered 204 and not logged', async () => {
  const oversized = inlineScriptOn('/zu-gross')
  Object.assign(oversized['csp-report'], { 'script-sample': 'x'.repeat(20_000) })

  const res = await report(REPORT_URI, oversized)

  expect(res.status).toBe(204)
  expect(await loggedAbout('/zu-gross')).toEqual([])
})

test('reports over the limit of one address are dropped silently, until the next window', async () => {
  const address = newAddress()
  await useUpAddressLimit(address, 'csp-report', ADDRESS_RATE_LIMITS['csp-report'].calls - 1)

  const last = await report(REPORT_URI, inlineScriptOn('/limit/last'), address)
  const over = await report(REPORT_URI, inlineScriptOn('/limit/over'), address)
  const other = await report(REPORT_URI, inlineScriptOn('/limit/other'))
  await endAddressLimitWindow(address, 'csp-report')
  const next = await report(REPORT_URI, inlineScriptOn('/limit/next'), address)

  expect([last.status, over.status, other.status, next.status]).toEqual([204, 204, 204, 204])
  const logged = await loggedAbout('/limit/') as { document: string }[]
  expect(logged.map(line => line.document)).toEqual([
    'https://malkochen.example/limit/last',
    'https://malkochen.example/limit/other',
    'https://malkochen.example/limit/next',
  ])
})

test('a report from another origin is refused like any write', async () => {
  const res = await anonymous().fetch('/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': REPORT_URI, 'origin': 'https://other.christried.me' },
    body: JSON.stringify(inlineScriptOn('/fremd')),
  })

  expect(res.status).toBe(403)
  expect(await loggedAbout('/fremd')).toEqual([])
})
