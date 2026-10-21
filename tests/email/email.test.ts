import { describe, expect, test } from 'vitest'
import { accountDeletedEmail, createMailSender, digestEmail, signInCodeEmail, type Email } from '../../server/email'

// Seam 6: the emails malkochen sends (the Email Digest, the sign-in code,
// the account deleted email)
// and their sending, with Resend faked at
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
      expect(part).toContain('aggiunto da Grace')
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

describe('the sign-in code email', () => {
  test('gives the code, how long it works, and a link that signs in with it', () => {
    const email = signInCodeEmail({ email: 'ada@example.com', language: 'de' }, '042137', 10, ORIGIN)

    expect(email.to).toBe('ada@example.com')
    expect(email.subject).toBe('042137 ist dein Code für malkochen')
    for (const part of [email.text, email.html]) {
      expect(part).toContain('Dein Code zum Anmelden')
      expect(part).toContain('Gib diesen Code in malkochen ein, da wo du die Anmeldung gestartet hast:')
      expect(part).toContain('042137')
      expect(part).toContain('Er gilt 10 Minuten und nur einmal.')
      expect(part).toContain('Oder melde dich direkt auf diesem Gerät an:')
      expect(part).toContain('Du wolltest dich nicht anmelden? Dann ignorier diese E-Mail einfach.')
    }
    expect(email.text).toContain('https://malkochen.example/login?email=ada%40example.com&code=042137')
    expect(email.html).toMatch(/<a href="https:\/\/malkochen\.example\/login\?email=ada%40example\.com&amp;code=042137"[^>]*>Anmelden<\/a>/)
  })

  test('in English and Italian', () => {
    const en = signInCodeEmail({ email: 'ada@example.com', language: 'en' }, '042137', 10, ORIGIN)
    expect(en.subject).toBe('042137 is your malkochen code')
    expect(en.text).toContain('Type this code into malkochen, where you started signing in:')
    expect(en.text).toContain('It works for 10 minutes, and only once.')
    expect(en.html).toContain('>Sign in</a>')

    const it = signInCodeEmail({ email: 'ada@example.com', language: 'it' }, '042137', 10, ORIGIN)
    expect(it.subject).toBe('042137 è il tuo codice per malkochen')
    expect(it.text).toContain('Inserisci questo codice in malkochen, dove hai iniziato ad accedere:')
    expect(it.text).toContain('Vale 10 minuti e una sola volta.')
    expect(it.html).toContain('>Accedi</a>')
  })
})

describe('the account deleted email', () => {
  test('confirms it, greeting them by Username, and says what stays and how to come back', () => {
    const email = accountDeletedEmail({ email: 'ada@example.com', name: 'Ada', language: 'de' })

    expect(email.to).toBe('ada@example.com')
    expect(email.subject).toBe('Dein malkochen-Konto ist gelöscht')
    for (const part of [email.text, email.html]) {
      expect(part).toContain('Hallo Ada, wie gewünscht haben wir dein Konto bei malkochen gelöscht.')
      expect(part).toContain('„Gelöschtes Konto“')
      expect(part).toContain('Melde dich einfach neu an.')
    }
    expect(email.html).toContain('<html lang="de">')
  })

  test('in English and Italian', () => {
    expect(accountDeletedEmail({ email: 'ada@example.com', name: 'Ada', language: 'en' }).subject).toBe('Your malkochen account is deleted')
    expect(accountDeletedEmail({ email: 'ada@example.com', name: 'Ada', language: 'it' }).text).toContain('Ciao Ada, come richiesto abbiamo eliminato il tuo account malkochen.')
  })
})

// Comments and Votes (#353): after a Board's new Dishes, „Im Verlauf" lists
// the Comments and Votes others gave on its Dishes.
describe('Comments and Votes', () => {
  const DAL = { title: 'Linsen-Dal', code: 'cd34' }
  const PASTA = { title: 'Cremige Pilzpasta', code: 'gh78' }

  test('a section per Board after its new Dishes: who, on which Dish (linked at its Verlauf), the Comment\'s start or the thumb', () => {
    const email = digestEmail(ADA, [{
      board: KOCHCLUB,
      dishes: [{ title: 'Ramen', code: 'ab12', addedBy: 'Grace' }],
      talk: [
        { dish: DAL, by: 'Linus', comment: 'Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!' },
        { dish: PASTA, by: 'Linus', up: true },
        { dish: DAL, by: 'Grace', up: false },
      ],
    }], ORIGIN)

    expect(email.subject).toBe('1 neues Gericht in 🍜 Kochclub')
    expect(email.html).toContain('Von Grace und Linus. Schau mal rein!')
    for (const part of [email.text, email.html]) {
      expect(part).toContain('Im Verlauf')
      expect(part.indexOf('Ramen')).toBeLessThan(part.indexOf('Im Verlauf'))
      expect(part).toContain('https://malkochen.example/b/kochclub/linsen-dal-cd34#verlauf')
      expect(part).toContain('https://malkochen.example/b/kochclub/cremige-pilzpasta-gh78#verlauf')
    }
    expect(email.text).toContain('Linus zu Linsen-Dal: „Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!“')
    expect(email.text).toContain('Linus fand Cremige Pilzpasta gut 👍')
    expect(email.text).toContain('Grace fand Linsen-Dal nicht so gut 👎')
    expect(email.html).toMatch(/Linus zu <a href="https:\/\/malkochen\.example\/b\/kochclub\/linsen-dal-cd34#verlauf"[^>]*>Linsen-Dal<\/a>: „Hab ich gestern nachgekocht, mit doppelt Ingwer\. Super!“/)
  })

  test('a long Comment is cut to its first ~100 characters, at a word', () => {
    const long = `${'Wort '.repeat(30)}Ende`
    const email = digestEmail(ADA, [{ board: KOCHCLUB, dishes: [], talk: [{ dish: DAL, by: 'Linus', comment: long }] }], ORIGIN)
    const [, quoted] = email.text.match(/„(.*)“/)!
    expect(quoted).toBe(`${'Wort '.repeat(20).trim()} …`)
    expect(email.text).not.toContain('Ende')
  })

  test('without new Dishes, the subject counts the Comments and Votes; the Board shows only its Verlauf', () => {
    const talk = [
      { dish: DAL, by: 'Linus', comment: 'Lecker' },
      { dish: DAL, by: 'Grace', comment: 'Ja!' },
      { dish: PASTA, by: 'Grace', up: true },
    ]
    const one = digestEmail(ADA, [{ board: KOCHCLUB, dishes: [], talk }], ORIGIN)
    expect(one.subject).toBe('2 Kommentare und 1 Daumen in 🍜 Kochclub')
    expect(one.html).not.toContain('<ul style="margin:0 0 12px;padding:0 0 0 20px">\n\n</ul>')

    const two = digestEmail(ADA, [
      { board: KOCHCLUB, dishes: [], talk: [{ dish: DAL, by: 'Linus', up: false }] },
      { board: SONNTAG, dishes: [], talk: [{ dish: PASTA, by: 'Grace', up: true }] },
    ], ORIGIN)
    expect(two.subject).toBe('2 Daumen auf deinen Boards')

    // New Dishes on one Board, Comments on another: the subject counts the Dishes.
    const mixed = digestEmail(ADA, [
      { board: KOCHCLUB, dishes: [{ title: 'Ramen', code: 'ab12', addedBy: 'Grace' }] },
      { board: SONNTAG, dishes: [], talk: [{ dish: PASTA, by: 'Grace', comment: 'Mmh' }] },
    ], ORIGIN)
    expect(mixed.subject).toBe('1 neues Gericht auf deinen Boards')
  })

  test('what Members typed in a Comment is escaped in the HTML', () => {
    const email = digestEmail(ADA, [{ board: KOCHCLUB, dishes: [], talk: [{ dish: { title: '<b>Dal</b>', code: 'cd34' }, by: 'Li<nus>', comment: '<script>alert(1)</script>' }] }], ORIGIN)
    expect(email.html).not.toContain('<script>')
    expect(email.html).not.toContain('<b>Dal')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.html).toContain('Li&lt;nus&gt; zu')
  })

  test('in English and Italian', () => {
    const news = [{ board: KOCHCLUB, dishes: [], talk: [{ dish: DAL, by: 'Linus', comment: 'Yum' }, { dish: PASTA, by: 'Grace', up: true }] }]
    const en = digestEmail({ ...ADA, language: 'en' }, news, ORIGIN)
    expect(en.subject).toBe('1 comment and 1 thumb in 🍜 Kochclub')
    expect(en.text).toContain('In the history')
    expect(en.text).toContain('Linus on Linsen-Dal: “Yum”')
    const it = digestEmail({ ...ADA, language: 'it' }, news, ORIGIN)
    expect(it.text).toContain('Nella cronologia')
    expect(it.text).toContain('Linus su Linsen-Dal: “Yum”')
    expect(it.text).toContain('Grace ha dato un pollice in su a Cremige Pilzpasta 👍')
  })
})
