import { describe, expect, test } from 'vitest'
import { createMailSender, digestEmail, type Email } from '../../server/email'

// Seam 6: the Email Digest's email and its sending, with Resend faked at
// its `fetch`. Who gets one, with which Dishes, is covered at Seam 1
// (tests/api/email-digest.test.ts).

const ORIGIN = 'https://malkochen.example'
const KOCHCLUB = { id: '0b5c2c1e-58a4-4c43-9a5e-3f3b7a1d2e4f', slug: 'kochclub', name: 'Kochclub', emoji: '🍜' }
const SONNTAG = { id: '7d1f3a52-1c0e-4a8b-9f6d-2e5b8c4a1f30', slug: 'sonntag', name: 'Sonntag', emoji: '🥞' }
const ADA = { email: 'ada@example.com', name: 'Ada', language: 'de' } as const

describe('the email', () => {
  test('greets them, lists each Board\'s new Dishes with who added them, and links to the Board and each Dish', () => {
    const email = digestEmail(ADA, [
      { board: KOCHCLUB, dishes: [{ title: 'Linsensuppe', code: 'ab12', addedBy: 'Linus' }, { title: 'Dal', code: 'cd34', addedBy: 'Grace' }] },
      { board: SONNTAG, dishes: [{ title: 'Pfannkuchen', code: 'ef56', addedBy: 'Linus' }] },
    ], ORIGIN)

    expect(email.to).toBe('ada@example.com')
    expect(email.subject).toBe('3 neue Gerichte auf deinen Boards')
    // The inbox's preview line: who added them.
    expect(email.html).toContain('Von Linus und Grace. Schau mal rein!')
    for (const part of [email.text, email.html]) {
      expect(part).toContain('Hallo Ada!')
      expect(part).toContain('Das ist seit gestern auf deinen Boards dazugekommen:')
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
      // Why it came, and where to switch it off again.
      expect(part).toContain('Einmal am Abend, nur wenn’s was Neues gibt: So hast du’s in malkochen eingestellt.')
      expect(part).toContain('Keine Lust mehr?')
      expect(part).toContain('Hier ausschalten')
      expect(part).toContain('https://malkochen.example/settings')
    }
    expect(email.html).toMatch(/<a href="https:\/\/malkochen\.example\/settings"[^>]*>Hier ausschalten<\/a>/)
  })

  test('about one Board, the subject names it; one Dish is „1 neues Gericht"', () => {
    const one = digestEmail(ADA, [{ board: KOCHCLUB, dishes: [{ title: 'Dal', code: 'cd34', addedBy: 'Grace' }] }], ORIGIN)
    expect(one.subject).toBe('1 neues Gericht in 🍜 Kochclub')

    const two = digestEmail(ADA, [{ board: KOCHCLUB, dishes: [{ title: 'Dal', code: 'cd34', addedBy: 'Grace' }, { title: 'Ramen', code: 'gh78', addedBy: 'Grace' }] }], ORIGIN)
    expect(two.subject).toBe('2 neue Gerichte in 🍜 Kochclub')
  })

  test('many adders: the preview names two and counts the others', () => {
    const dishes = ['Grace', 'Linus', 'Kati', 'Mile', 'Grace'].map((addedBy, i) => ({ title: `Gericht ${i}`, code: `c${i}`, addedBy }))
    expect(digestEmail(ADA, [{ board: KOCHCLUB, dishes }], ORIGIN).html).toContain('Von Grace, Linus und 2 andere. Schau mal rein!')
  })

  test('someone without a Username yet is greeted without a name', () => {
    const email = digestEmail({ ...ADA, name: null }, [{ board: KOCHCLUB, dishes: [{ title: 'Dal', code: 'cd34', addedBy: 'Grace' }] }], ORIGIN)
    for (const part of [email.text, email.html]) expect(part).toContain('Hallo!')
  })

  test('the plain text has no dashed separator line', () => {
    const email = digestEmail(ADA, [{ board: KOCHCLUB, dishes: [{ title: 'Dal', code: 'cd34', addedBy: 'Grace' }] }], ORIGIN)
    expect(email.text).not.toMatch(/^-{2,}\s*$/m)
  })

  test('what Members typed is escaped in the HTML, never markup', () => {
    const email = digestEmail(ADA, [{
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

describe('in the recipient\'s language', () => {
  const news = [{ board: KOCHCLUB, dishes: [{ title: 'Dal', code: 'cd34', addedBy: 'Grace' }, { title: 'Ramen', code: 'gh78', addedBy: 'Linus' }] }]

  test('English: every word around what Members typed', () => {
    const email = digestEmail({ ...ADA, language: 'en' }, news, ORIGIN)
    expect(email.subject).toBe('2 new dishes in 🍜 Kochclub')
    expect(email.html).toContain('From Grace and Linus. Take a look!')
    expect(email.html).toContain('<html lang="en">')
    for (const part of [email.text, email.html]) {
      expect(part).toContain('Hi Ada!')
      expect(part).toContain('Here’s what’s new on your boards since yesterday:')
      expect(part).toContain('by Grace')
      expect(part).toContain('Open board')
      expect(part).toContain('Turn it off here')
      expect(part).not.toContain('Hallo')
    }
  })

  test('Italian', () => {
    const email = digestEmail({ ...ADA, language: 'it' }, news, ORIGIN)
    expect(email.subject).toBe('2 nuovi piatti in 🍜 Kochclub')
    expect(email.html).toContain('<html lang="it">')
    for (const part of [email.text, email.html]) {
      expect(part).toContain('Ciao Ada!')
      expect(part).toContain('di Grace')
      expect(part).toContain('Apri la bacheca')
      expect(part).toContain('Disattivala qui')
    }
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
