import { afterAll, beforeAll, beforeEach, describe, expect, inject, test } from 'vitest'
import { CLIENT_RATE_LIMITS } from '../../server/rate-limits'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { startResendService, type ResendService } from '../support/resend-service'
import { endClientLimitWindow, expireSignInCode, useUpClientLimit } from './time-travel'

// Email sign-in with a code (#345, ADR 0007): POST
// /api/auth/email-otp/send-verification-otp { email, type: 'sign-in' } emails
// a 6-digit code and a link carrying it (to a stand-in for Resend, which keeps
// it); POST /api/auth/sign-in/email-otp { email, otp } signs in with it. The
// users below are used by this file only.

const BELL = ALLOWLISTED[110]
const SABIN = ALLOWLISTED[111]
const APGAR = ALLOWLISTED[112]
const MAATHAI = ALLOWLISTED[113]
const MONTESSORI = ALLOWLISTED[114]
const NIGHTINGALE = ALLOWLISTED[115]
const SANGER = ALLOWLISTED[116]
const FARADAY = ALLOWLISTED[128]
const HOOKE = ALLOWLISTED[129]

let resend: ResendService

beforeAll(async () => {
  resend = await startResendService()
})

afterAll(() => resend.close())

beforeEach(() => resend.forget())

// A browser of its own: it keeps its cookies, and comes from an address of
// its own (x-forwarded-for, as on Vercel), so Better Auth's limit per address
// counts each test apart. New each run, so a rerun against the same server
// starts clean.
let clients = 0
function visitor(): Caller & { address: string } {
  const address = `2001:db8:${(Date.now() % 0xffff).toString(16)}:${(++clients).toString(16)}::1`
  const jar = new Map<string, string>()
  return {
    address,
    fetch: async (path, init) => {
      const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
      const res = await fetch(`${inject('apiBaseUrl')}${path}`, {
        ...init,
        headers: { 'accept-language': 'de-DE,de;q=0.9', ...init?.headers, cookie, 'x-forwarded-for': address },
      })
      for (const set of res.headers.getSetCookie()) {
        const [pair = ''] = set.split(';')
        const name = pair.slice(0, pair.indexOf('='))
        const value = pair.slice(pair.indexOf('=') + 1)
        if (value === '' || /max-age=0\b/i.test(set)) jar.delete(name)
        else jar.set(name, value)
      }
      return res
    },
  }
}

// A JSON POST as a browser sends it: Better Auth refuses POSTs without an
// Origin.
function post(caller: Caller, path: string, body: unknown, headers: Record<string, string> = {}) {
  return caller.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': inject('apiBaseUrl'), ...headers },
    body: JSON.stringify(body),
  })
}

const askForCode = (caller: Caller, email: string, headers?: Record<string, string>) =>
  post(caller, '/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' }, headers)

const signInWithCode = (caller: Caller, email: string, otp: string) =>
  post(caller, '/api/auth/sign-in/email-otp', { email, otp })

// The code in the last email sent to `email`.
function codeSentTo(email: string): string {
  const sent = resend.sent.findLast(e => e.to.includes(email))
  if (!sent) throw new Error(`no email to ${email}`)
  return sent.text.match(/\b\d{6}\b/)![0]
}

describe('signing in with a code', () => {
  test('the code from the email signs in a new user, who is asked for a Username', async () => {
    const browser = visitor()

    expect((await askForCode(browser, BELL)).status).toBe(200)
    expect(resend.sent).toHaveLength(1)
    const res = await signInWithCode(browser, BELL, codeSentTo(BELL))

    expect(res.status).toBe(200)
    const me = await (await browser.fetch('/api/me')).json()
    expect(me).toMatchObject({ email: BELL, usernamePrompt: 'pick' })
  })

  test('an address that signed in with Google signs into that same account', async () => {
    const google = await (await (await signIn(SABIN)).fetch('/api/me')).json()
    const browser = visitor()

    await askForCode(browser, SABIN)
    await signInWithCode(browser, SABIN, codeSentTo(SABIN))

    expect((await (await browser.fetch('/api/me')).json()).id).toBe(google.id)
  })

  test('a code works once', async () => {
    const browser = visitor()
    await askForCode(browser, APGAR)
    const code = codeSentTo(APGAR)
    expect((await signInWithCode(browser, APGAR, code)).status).toBe(200)

    const again = await signInWithCode(visitor(), APGAR, code)

    expect(again.status).toBe(400)
    expect(again.headers.getSetCookie()).toEqual([])
  })

  test('a wrong code is refused, and after 5 wrong tries the right one is too', async () => {
    const browser = visitor()
    await askForCode(browser, MAATHAI)
    const code = codeSentTo(MAATHAI)
    const wrong = code === '000000' ? '111111' : '000000'

    const first = await signInWithCode(browser, MAATHAI, wrong)
    expect(first.status).toBe(400)
    expect((await first.json()).code).toBe('INVALID_OTP')
    for (let i = 0; i < 4; i++) await signInWithCode(visitor(), MAATHAI, wrong)

    const right = await signInWithCode(visitor(), MAATHAI, code)
    expect(right.status).toBe(403)
    expect((await right.json()).code).toBe('TOO_MANY_ATTEMPTS')
  })

  test('an expired code is refused; a new one works', async () => {
    const browser = visitor()
    await askForCode(browser, MONTESSORI)
    const old = codeSentTo(MONTESSORI)
    await expireSignInCode(MONTESSORI)

    const expired = await signInWithCode(browser, MONTESSORI, old)
    expect(expired.status).toBe(400)
    expect((await expired.json()).code).toBe('OTP_EXPIRED')

    await askForCode(browser, MONTESSORI)
    expect((await signInWithCode(browser, MONTESSORI, codeSentTo(MONTESSORI))).status).toBe(200)
  })

  test('Better Auth limits asking for codes per IP address', async () => {
    const browser = visitor()
    const answers = []
    for (let i = 0; i < 6; i++) answers.push((await askForCode(browser, SANGER)).status)

    expect(answers).toEqual([200, 200, 200, 200, 200, 429])
  })
})

// Codes per address and per IP address per hour (#347,
// server/rate-limits.ts), so nobody can spam an inbox or use up the email
// quota. Over either, no email goes out: 429 "TOO_MANY_CODES", with when
// another code can be asked for.
describe('limits on sign-in codes', () => {
  async function refusedUntil(res: Response): Promise<number> {
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.code).toBe('TOO_MANY_CODES')
    return new Date(body.retryAt).getTime()
  }

  test('an address gets only so many codes an hour, from any IP address', async () => {
    const { calls } = CLIENT_RATE_LIMITS['sign-in-codes-per-address']
    await useUpClientLimit(FARADAY, 'sign-in-codes-per-address', calls - 1)

    expect((await askForCode(visitor(), FARADAY)).status).toBe(200)
    const retryAt = await refusedUntil(await askForCode(visitor(), FARADAY))
    expect(resend.sent).toHaveLength(1)
    expect(retryAt).toBeGreaterThan(Date.now() + 55 * 60_000)
    expect(retryAt).toBeLessThanOrEqual(Date.now() + 60 * 60_000)

    await endClientLimitWindow(FARADAY, 'sign-in-codes-per-address')
    expect((await askForCode(visitor(), FARADAY)).status).toBe(200)
  })

  test('an IP address gets only so many codes an hour, for any address', async () => {
    const browser = visitor()
    const { calls } = CLIENT_RATE_LIMITS['sign-in-codes-per-ip']
    await useUpClientLimit(browser.address, 'sign-in-codes-per-ip', calls - 1)

    expect((await askForCode(browser, HOOKE)).status).toBe(200)
    await refusedUntil(await askForCode(browser, FARADAY))
    expect((await askForCode(visitor(), HOOKE)).status).toBe(200)

    await endClientLimitWindow(browser.address, 'sign-in-codes-per-ip')
    expect((await askForCode(browser, HOOKE)).status).toBe(200)
  })
})

describe('the sign-in gate', () => {
  test('an address not on the Allowlist gets no code: "not_allowed", as after Google', async () => {
    const res = await askForCode(visitor(), 'stranger@example.com')

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_allowed')
    expect(resend.sent).toEqual([])
  })

  test('only sign-in codes are sent', async () => {
    const res = await post(visitor(), '/api/auth/email-otp/send-verification-otp', { email: SABIN, type: 'email-verification' })

    expect(res.status).toBe(400)
    expect(resend.sent).toEqual([])
  })
})

describe('the email', () => {
  test("carries the code and a link to the sign-in page with it, in the browser's language", async () => {
    await askForCode(visitor(), NIGHTINGALE, { 'accept-language': 'it-IT,it;q=0.9' })

    const [email] = resend.sent
    const code = codeSentTo(NIGHTINGALE)
    expect(email!.subject).toBe(`${code} è il tuo codice per malkochen`)
    expect(email!.text).toContain(`${inject('apiBaseUrl')}/login?email=nightingale%40example.com&code=${code}`)
  })
})
