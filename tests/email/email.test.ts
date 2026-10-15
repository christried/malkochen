import { describe, expect, test } from 'vitest'
import { createMailSender, digestEmail, type Email } from '../../server/email'

// Seam 6: the Email Digest's email and its sending, with Resend faked at
// its `fetch`. Who gets one, with which Dishes, is covered at Seam 1
// (tests/api/email-digest.test.ts).

const ORIGIN = 'https://malkochen.example'
const KOCHCLUB = { id: '0b5c2c1e-58a4-4c43-9a5e-3f3b7a1d2e4f', slug: 'kochclub', name: 'Kochclub', emoji: '🍜' }
const SONNTAG = { id: '7d1f3a52-1c0e-4a8b-9f6d-2e5b8c4a1f30', slug: 'sonntag', name: 'Sonntag', emoji: '🥞' }

describe('the email', () => {
  test('lists each Board\'s new Dishes with who added them, and links to the Board and each Dish', () => {
    const email = digestEmail('ada@example.com', [
      { board: KOCHCLUB, dishes: [{ title: 'Linsensuppe', code: 'ab12', addedBy: 'Linus' }, { title: 'Dal', code: 'cd34', addedBy: 'Grace' }] },
      { board: SONNTAG, dishes: [{ title: 'Pfannkuchen', code: 'ef56', addedBy: 'Linus' }] },
    ], ORIGIN)

    expect(email.to).toBe('ada@example.com')
    expect(email.subject).toBe('Neu auf deinen Boards: 3 Gerichte')
    for (const part of [email.text, email.html]) {
      expect(part).toContain('🍜 Kochclub')
      expect(part).toContain('Linsensuppe')
      expect(part).toContain('von Linus')
      expect(part).toContain('Dal')
      expect(part).toContain('von Grace')
      expect(part).toContain('🥞 Sonntag')
      expect(part).toContain('Pfannkuchen')
      expect(part).toContain('https://malkochen.example/b/kochclub')
      expect(part).toContain('https://malkochen.example/b/kochclub/linsensuppe-ab12')
      expect(part).toContain('https://malkochen.example/b/sonntag')
      // Where to switch it off again.
      expect(part).toContain('https://malkochen.example/settings')
    }
  })

  test('one Dish: the subject says so', () => {
    const email = digestEmail('ada@example.com', [{ board: KOCHCLUB, dishes: [{ title: 'Dal', code: 'cd34', addedBy: 'Grace' }] }], ORIGIN)
    expect(email.subject).toBe('Neu auf deinen Boards: 1 Gericht')
  })

  test('what Members typed is escaped in the HTML, never markup', () => {
    const email = digestEmail('ada@example.com', [{
      board: { ...KOCHCLUB, name: 'Koch<b>club</b>' },
      dishes: [{ title: '<img src=x onerror=alert(1)> & "Dal"', code: 'cd34', addedBy: 'Gr<ace>' }],
    }], ORIGIN)

    expect(email.html).not.toContain('<img src=x')
    expect(email.html).not.toContain('<b>club')
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Dal&quot;')
    expect(email.html).toContain('Koch&lt;b&gt;club&lt;/b&gt;')
    expect(email.html).toContain('von Gr&lt;ace&gt;')
    // The text part shows them as typed.
    expect(email.text).toContain('<img src=x onerror=alert(1)> & "Dal"')
  })
})

describe('sending', () => {
  const email = (to: string): Email => ({ to, subject: 'Neu auf deinen Boards: 1 Gericht', html: '<p>Dal</p>', text: 'Dal' })

  interface Call { url: string, init: RequestInit }

  function fakeResend(answer: (call: Call) => Response | Promise<Response>) {
    const calls: Call[] = []
    const fetch = (async (url: string, init: RequestInit) => {
      const call = { url: String(url), init }
      calls.push(call)
      return answer(call)
    }) as typeof globalThis.fetch
    return { calls, fetch }
  }

  const sent = () => Response.json({ data: [] })

  test('posts the emails to Resend\'s batch endpoint from the app\'s address, with the API key', async () => {
    const resend = fakeResend(sent)
    const send = createMailSender({ apiKey: 're_test_key', baseUrl: 'https://resend.example', fetch: resend.fetch })

    const outcome = await send([email('ada@example.com'), email('linus@example.com')])

    expect(outcome).toEqual({ sent: ['ada@example.com', 'linus@example.com'], failed: [] })
    expect(resend.calls).toHaveLength(1)
    const [call] = resend.calls
    expect(call!.url).toBe('https://resend.example/emails/batch')
    expect(call!.init.method).toBe('POST')
    expect(new Headers(call!.init.headers).get('authorization')).toBe('Bearer re_test_key')
    expect(JSON.parse(String(call!.init.body))).toEqual([
      { from: 'malkochen <malkochen@christried.me>', to: ['ada@example.com'], subject: 'Neu auf deinen Boards: 1 Gericht', html: '<p>Dal</p>', text: 'Dal' },
      { from: 'malkochen <malkochen@christried.me>', to: ['linus@example.com'], subject: 'Neu auf deinen Boards: 1 Gericht', html: '<p>Dal</p>', text: 'Dal' },
    ])
  })

  test('more than a batch takes (100) goes out in several', async () => {
    const resend = fakeResend(sent)
    const send = createMailSender({ apiKey: 're_test_key', fetch: resend.fetch })
    const many = Array.from({ length: 205 }, (_, i) => email(`member${i}@example.com`))

    const outcome = await send(many)

    expect(outcome.sent).toHaveLength(205)
    expect(resend.calls.map(c => (JSON.parse(String(c.init.body)) as unknown[]).length)).toEqual([100, 100, 5])
    expect(resend.calls[0]!.url).toBe('https://api.resend.com/emails/batch')
  })

  test('a batch Resend refuses, or that can\'t reach it, counts as not sent; the others still go out', async () => {
    let call = 0
    const failures: string[] = []
    const resend = fakeResend(() => {
      call++
      if (call === 1) return Response.json({ statusCode: 422, name: 'validation_error', message: 'Invalid `to` field' }, { status: 422 })
      if (call === 2) throw new TypeError('fetch failed')
      return sent()
    })
    const send = createMailSender({ apiKey: 're_test_key', fetch: resend.fetch, onFailure: reason => failures.push(reason) })
    const many = Array.from({ length: 201 }, (_, i) => email(`member${i}@example.com`))

    const outcome = await send(many)

    expect(outcome.failed).toHaveLength(200)
    expect(outcome.sent).toEqual(['member200@example.com'])
    expect(failures).toHaveLength(2)
    expect(failures[0]).toContain('422')
    expect(failures[1]).toContain('fetch failed')
  })

  test('nothing to send: Resend is not called', async () => {
    const resend = fakeResend(sent)
    const send = createMailSender({ apiKey: 're_test_key', fetch: resend.fetch })
    expect(await send([])).toEqual({ sent: [], failed: [] })
    expect(resend.calls).toHaveLength(0)
  })
})
