import { createECDH, randomBytes } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { createPushSender, isPushEndpoint, pushMessage, type BoardNews, type PushTarget } from '../../server/push'
import { TEST_VAPID_PUBLIC_KEY } from '../support/test-auth-env'

// Seam 5: push notifications' messages and their sending, with the push
// service faked. Who gets them, and what a device decrypts, is covered at
// Seam 1 (tests/api/push.test.ts).

const BOARD: BoardNews['board'] = { id: '0b5c2c1e-58a4-4c43-9a5e-3f3b7a1d2e4f', slug: 'kochclub', name: 'Kochclub', emoji: '🍪' }

describe('the push services a subscription may be on', () => {
  test.each([
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/QGuQyavXu',
  ])('%s is a push service', (endpoint) => {
    expect(isPushEndpoint(endpoint)).toBe(true)
  })

  test.each([
    ['plain http', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['another host', 'https://example.com/push'],
    ['a look-alike host', 'https://fcm.googleapis.com.example.com/fcm/send/abc'],
    ['the app\'s own network', 'https://127.0.0.1/push'],
    ['no link', 'not a link'],
  ])('%s is not', (_, endpoint) => {
    expect(isPushEndpoint(endpoint)).toBe(false)
  })

  test('local dev and tests take any http(s) address, nothing else', () => {
    expect(isPushEndpoint('http://127.0.0.1:4000/push/a', { anyService: true })).toBe(true)
    expect(isPushEndpoint('ftp://127.0.0.1/push/a', { anyService: true })).toBe(false)
  })
})

describe('the message', () => {
  const PICTURE = 'https://images.example/linsen-dal.jpg'
  // A Dish as the server hands it over: no Creator, Source or image unless given.
  const dish = (title: string, code: string, addedBy: string, extra: Partial<BoardNews['dishes'][number]> = {}) =>
    ({ title, code, addedBy, creator: null, kind: null, image: null, ...extra })
  // The Dishes, newest first, the i-th added by addedBy[i] (else by the first).
  const added = (addedBy: string[], titles = addedBy.map((_, i) => `Gericht ${i}`)) =>
    titles.map((title, i) => dish(title, `c${i}`, addedBy[i] ?? addedBy[0]!))

  test('one Dish: who added it, its title, then its Creator and Source, and it opens the Dish', () => {
    const dal = dish('Linsen-Dal', 'c0', 'Ada', { creator: 'Mara', kind: 'tiktok', image: PICTURE })

    expect(pushMessage('de', { board: BOARD, dishes: [dal] })).toEqual({
      title: 'Von Ada in Kochclub',
      body: 'Linsen-Dal von Mara auf TikTok',
      lang: 'de',
      tag: `board-${BOARD.id}`,
      url: '/b/kochclub/linsen-dal-c0',
      image: PICTURE,
    })
  })

  test('one Dish without Creator or Source: only its title, and no picture when it has a Placeholder Image', () => {
    const { body, image } = pushMessage('de', { board: BOARD, dishes: [dish('Linsen-Dal', 'c0', 'Ada')] })
    expect(body).toBe('Linsen-Dal')
    expect(image).toBeUndefined()
  })

  test('the Creator alone, and the Source\'s platform alone; a blog names no platform', () => {
    expect(pushMessage('de', { board: BOARD, dishes: [dish('Linsen-Dal', 'c0', 'Ada', { creator: 'Mara' })] }).body).toBe('Linsen-Dal von Mara')
    expect(pushMessage('de', { board: BOARD, dishes: [dish('Linsen-Dal', 'c0', 'Ada', { kind: 'instagram-post' })] }).body).toBe('Linsen-Dal auf Instagram')
    expect(pushMessage('de', { board: BOARD, dishes: [dish('Linsen-Dal', 'c0', 'Ada', { kind: 'blog' })] }).body).toBe('Linsen-Dal')
  })

  test('several Dishes: how many, then their titles, and it opens the Board with the newest Dish\'s picture', () => {
    const dishes = added(['Ada'], ['Linsen-Dal', 'Cremige Pilzpasta', 'Ofengemüse mit Tahini'])
    dishes[0] = { ...dishes[0]!, image: PICTURE }

    expect(pushMessage('de', { board: BOARD, dishes })).toEqual({
      title: 'Von Ada in Kochclub',
      body: '3 neue Gerichte: Linsen-Dal, Cremige Pilzpasta, Ofengemüse mit Tahini',
      lang: 'de',
      tag: `board-${BOARD.id}`,
      url: '/b/kochclub',
      image: PICTURE,
    })
  })

  test('up to three adders are all named, the latest first and the last joined with „und"', () => {
    expect(pushMessage('de', { board: BOARD, dishes: added(['Linus', 'Ada']) }).title).toBe('Von Linus und Ada in Kochclub')
    expect(pushMessage('de', { board: BOARD, dishes: added(['Ada', 'Linus', 'Grace', 'Ada']) }).title).toBe('Von Ada, Linus und Grace in Kochclub')
  })

  test('four or more adders: the latest two are named, the others counted', () => {
    expect(pushMessage('de', { board: BOARD, dishes: added(['Grace', 'Linus', 'Kati', 'Ada', 'Grace']) }).title)
      .toBe('Von Grace, Linus und 2 andere in Kochclub')
  })

  test('a long list of titles ends with how many more, so the push stays small and no title is cut', () => {
    const titles = Array.from({ length: 40 }, (_, i) => `Ein ziemlich langes Gericht Nummer ${i}`)

    const { title, body } = pushMessage('de', { board: BOARD, dishes: added(['Ada'], titles) })

    expect(title).toBe('Von Ada in Kochclub')
    expect(body).toBe('40 neue Gerichte: Ein ziemlich langes Gericht Nummer 0, Ein ziemlich langes Gericht Nummer 1 und 38 weitere')
  })

  test('one more is „1 weiteres"', () => {
    const titles = ['Ein langes Gericht mit vielen Zutaten', 'Noch ein langes Gericht mit Zutaten', 'Ein drittes ziemlich langes Gericht']
    expect(pushMessage('de', { board: BOARD, dishes: added(['Ada'], titles) }).body)
      .toBe('3 neue Gerichte: Ein langes Gericht mit vielen Zutaten, Noch ein langes Gericht mit Zutaten und 1 weiteres')
  })

  test('a first title too long on its own is cut to fit, the rest counted', () => {
    const { body } = pushMessage('de', { board: BOARD, dishes: added(['Ada'], ['x'.repeat(300), 'Dal']) })
    expect(body).toMatch(/^2 neue Gerichte: x+ … und 1 weiteres$/)
    expect(body.length).toBeLessThanOrEqual(120)
  })

  test('the cut never splits an emoji', () => {
    const { body } = pushMessage('de', { board: BOARD, dishes: added(['Ada'], ['🍕'.repeat(150), 'Dal']) })
    expect(body).toMatch(/^2 neue Gerichte: (🍕)+ … und 1 weiteres$/u)
    expect(body.length).toBeLessThanOrEqual(120)
  })
})

describe('Comments and Votes (#352)', () => {
  const PICTURE = 'https://images.example/linsen-dal.jpg'
  const RAMEN_PICTURE = 'https://images.example/ramen.jpg'
  const DAL: { title: string, code: string, image: string | null } = { title: 'Linsen-Dal', code: 'd1', image: PICTURE }
  const PASTA: { title: string, code: string, image: string | null } = { title: 'Cremige Pilzpasta', code: 'p2', image: null }
  const DAL_HISTORY = '/b/kochclub/linsen-dal-d1#verlauf'
  const comment = (by: string, dish = DAL, text = 'Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!') => ({ dish, by, comment: text })
  const vote = (by: string, dish = DAL, up = true) => ({ dish, by, up })
  const dish = (title: string, code: string, addedBy: string, image: string | null = null) =>
    ({ title, code, addedBy, creator: null, kind: null, image })

  test('one Comment: who commented on which Dish, the Comment below, and it opens the Dish at its Verlauf', () => {
    expect(pushMessage('de', { board: BOARD, dishes: [], talk: [comment('Ada')] })).toEqual({
      title: 'Von Ada in Kochclub',
      body: 'Kommentar zu Linsen-Dal: „Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!“',
      lang: 'de',
      tag: `board-${BOARD.id}`,
      url: DAL_HISTORY,
      image: PICTURE,
    })
  })

  test('a long Comment is cut to fit on whole words, on one line', () => {
    const text = 'Hab ich gestern nachgekocht,\nmit doppelt Ingwer und viel mehr Knoblauch als im Rezept steht. Beim nächsten Mal nehme ich auch noch Kokosmilch dazu.'
    const { body } = pushMessage('de', { board: BOARD, dishes: [], talk: [comment('Ada', DAL, text)] })
    const shown = body.slice('Kommentar zu Linsen-Dal: „'.length, -' …“'.length)
    expect(body).toMatch(/^Kommentar zu Linsen-Dal: „.+ …“$/)
    expect(text.replace(/\s+/g, ' ').startsWith(shown)).toBe(true)
    expect(body.length).toBeLessThanOrEqual(120)
  })

  test('a Comment that is one long word is cut by characters, never inside an emoji', () => {
    const { body } = pushMessage('de', { board: BOARD, dishes: [], talk: [comment('Ada', DAL, '😋'.repeat(100))] })
    expect(body).toMatch(/^Kommentar zu Linsen-Dal: „(😋)+ …“$/u)
    expect(body.length).toBeLessThanOrEqual(120)
  })

  test('one Vote: who thought what of which Dish, the Dish with its thumb, and the Dish\'s picture', () => {
    expect(pushMessage('de', { board: BOARD, dishes: [], talk: [vote('Ada')] })).toMatchObject({ title: 'Von Ada in Kochclub', body: 'Linsen-Dal 👍', url: DAL_HISTORY, image: PICTURE })
    expect(pushMessage('de', { board: BOARD, dishes: [], talk: [vote('Ada', DAL, false)] }).body).toBe('Linsen-Dal 👎')
  })

  test('several things on one Dish: who, the latest first, and how many of each; it opens the Dish at its Verlauf', () => {
    expect(pushMessage('de', { board: BOARD, dishes: [], talk: [vote('Linus'), comment('Ada')] })).toMatchObject({
      title: 'Von Linus und Ada in Kochclub',
      body: 'Linsen-Dal: 1 Kommentar, 1 Daumen',
      url: DAL_HISTORY,
    })
    expect(pushMessage('de', { board: BOARD, dishes: [], talk: [comment('Ada'), comment('Ada')] })).toMatchObject({
      title: 'Von Ada in Kochclub',
      body: 'Linsen-Dal: 2 Kommentare',
    })
  })

  test('Comments and Votes on several Dishes: who, how many of each, on which Dishes; it opens the Board', () => {
    expect(pushMessage('de', { board: BOARD, dishes: [], talk: [comment('Ada', PASTA), vote('Linus', PASTA), comment('Linus'), comment('Ada')] })).toMatchObject({
      title: 'Von Ada und Linus in Kochclub',
      body: '3 Kommentare und 1 Daumen zu Cremige Pilzpasta und Linsen-Dal',
      url: '/b/kochclub',
    })
  })

  test('only Votes on several Dishes: who gave how many', () => {
    expect(pushMessage('de', { board: BOARD, dishes: [], talk: [vote('Ada', PASTA), vote('Ada', DAL, false)] })).toMatchObject({
      title: 'Von Ada in Kochclub',
      body: '2 Daumen zu Cremige Pilzpasta und Linsen-Dal',
    })
  })

  test('with new Dishes: the Dishes\' wording, then how many Comments and Votes, with the newest Dish\'s picture', () => {
    const dishes = [dish('Ramen', 'r3', 'Ada', RAMEN_PICTURE), dish('Ofengemüse mit Tahini', 'o4', 'Ada')]
    expect(pushMessage('de', { board: BOARD, dishes, talk: [comment('Linus'), vote('Linus', PASTA), comment('Ada', PASTA)] })).toMatchObject({
      title: 'Von Ada und Linus in Kochclub',
      body: '2 neue Gerichte: Ramen, Ofengemüse mit Tahini. Dazu 2 Kommentare und 1 Daumen.',
      url: '/b/kochclub',
      image: RAMEN_PICTURE,
    })
  })

  test('a new Dish and a Comment on it are about one Dish: it opens that Dish at its Verlauf', () => {
    const dishes = [dish('Linsen-Dal', 'd1', 'Ada', PICTURE)]
    expect(pushMessage('de', { board: BOARD, dishes, talk: [comment('Linus')] })).toMatchObject({
      title: 'Von Ada und Linus in Kochclub',
      body: 'Linsen-Dal. Dazu 1 Kommentar.',
      url: DAL_HISTORY,
    })
  })

  test('in English and Italian', () => {
    expect(pushMessage('en', { board: BOARD, dishes: [], talk: [comment('Ada')] })).toMatchObject({ title: 'From Ada in Kochclub', body: 'Comment on Linsen-Dal: “Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!”' })
    expect(pushMessage('en', { board: BOARD, dishes: [], talk: [vote('Linus'), comment('Ada')] }).body).toBe('Linsen-Dal: 1 comment, 1 thumb')
    expect(pushMessage('it', { board: BOARD, dishes: [], talk: [vote('Ada')] })).toMatchObject({ title: 'Da Ada in Kochclub', body: 'Linsen-Dal 👍' })
    expect(pushMessage('it', { board: BOARD, dishes: [], talk: [comment('Ada')] }).body).toBe('Commento a Linsen-Dal: “Hab ich gestern nachgekocht, mit doppelt Ingwer. Super!”')
  })
})

describe('in the recipient\'s language', () => {
  const dishes = [
    { title: 'Linsen-Dal', code: 'c0', addedBy: 'Ada', creator: 'Mara', kind: 'youtube-short' as const, image: null },
    { title: 'Ramen', code: 'c1', addedBy: 'Linus', creator: null, kind: null, image: null },
  ]

  test('English', () => {
    expect(pushMessage('en', { board: BOARD, dishes: dishes.slice(0, 1) })).toMatchObject({ title: 'From Ada in Kochclub', body: 'Linsen-Dal by Mara on YouTube' })
    expect(pushMessage('en', { board: BOARD, dishes: dishes.slice(0, 1) }).lang).toBe('en')
    expect(pushMessage('en', { board: BOARD, dishes })).toMatchObject({ title: 'From Ada and Linus in Kochclub', body: '2 new dishes: Linsen-Dal, Ramen' })
  })

  test('Italian', () => {
    expect(pushMessage('it', { board: BOARD, dishes: dishes.slice(0, 1) })).toMatchObject({ title: 'Da Ada in Kochclub', body: 'Linsen-Dal di Mara su YouTube' })
    expect(pushMessage('it', { board: BOARD, dishes })).toMatchObject({ title: 'Da Ada e Linus in Kochclub', body: '2 nuovi piatti: Linsen-Dal, Ramen' })
  })
})

describe('sending', () => {
  const vapid = { subject: 'mailto:push@example.com', publicKey: TEST_VAPID_PUBLIC_KEY, privateKey: 'JNU3GrAgBSIppqVi0CPJWJGluyMLazk2eUdxmB4gSEg' }
  const message = pushMessage('de', { board: BOARD, dishes: [{ title: 'Dal', code: 'ab12', addedBy: 'Ada', creator: null, kind: null, image: null }] })

  function device(): PushTarget {
    const ecdh = createECDH('prime256v1')
    ecdh.generateKeys()
    return { endpoint: 'https://fcm.googleapis.com/fcm/send/device', p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') }
  }

  function fakeService(answer: () => Response | Promise<Response>) {
    const requests: { url: string, init: RequestInit }[] = []
    const failures: string[] = []
    const send = createPushSender({
      vapid,
      fetch: async (url, init) => {
        requests.push({ url: String(url), init: init! })
        return answer()
      },
      onFailure: reason => failures.push(reason),
    })
    return { send, requests, failures }
  }

  test('a push is encrypted, signed with the VAPID key, kept a day at most, and replaces one about the same Board not yet delivered', async () => {
    const { send, requests } = fakeService(() => new Response(null, { status: 201 }))

    expect(await send(device(), message)).toBe('sent')

    const [{ url, init }] = requests as [typeof requests[number]]
    expect(url).toBe('https://fcm.googleapis.com/fcm/send/device')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Encoding': 'aes128gcm',
      'TTL': 86400,
      'Topic': '0b5c2c1e58a44c439a5e3f3b7a1d2e4f',
      'Authorization': expect.stringMatching(new RegExp(`^vapid t=.+, k=${TEST_VAPID_PUBLIC_KEY}$`)),
    })
    expect(init.body).toBeInstanceOf(Uint8Array)
  })

  test.each([404, 410])('a subscription answered %i is gone', async (status) => {
    const { send, failures } = fakeService(() => new Response(null, { status }))
    expect(await send(device(), message)).toBe('gone')
    expect(failures).toEqual([])
  })

  test('any other refusal, or no answer at all, is a failure that is reported, never thrown', async () => {
    const refused = fakeService(() => new Response(null, { status: 429 }))
    expect(await refused.send(device(), message)).toBe('failed')
    expect(refused.failures).toEqual(['fcm.googleapis.com answered 429'])

    const down = fakeService(() => Promise.reject(new TypeError('fetch failed')))
    expect(await down.send(device(), message)).toBe('failed')
    expect(down.failures).toEqual(['fcm.googleapis.com: fetch failed'])
  })

  test('a subscription whose keys don\'t work is a failure too', async () => {
    const { send, requests, failures } = fakeService(() => new Response(null, { status: 201 }))
    expect(await send({ ...device(), p256dh: 'broken' }, message)).toBe('failed')
    expect(requests).toEqual([])
    expect(failures).toHaveLength(1)
  })
})
