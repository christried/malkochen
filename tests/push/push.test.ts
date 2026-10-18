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
  // The Dishes, newest first, the i-th added by addedBy[i] (else by the first).
  const added = (addedBy: string[], titles = addedBy.map((_, i) => `Gericht ${i}`)) =>
    titles.map((title, i) => ({ title, code: `c${i}`, addedBy: addedBy[i] ?? addedBy[0]! }))

  test('one Dish: who added it and its title, the Board below, and it opens the Dish', () => {
    const { title, body, url } = pushMessage({ board: BOARD, dishes: added(['Ada'], ['Linsen-Dal']) })

    expect(title).toBe('Ada hat Linsen-Dal hinzugefügt')
    expect(body).toBe('🍪 Kochclub')
    expect(url).toBe('/b/kochclub/linsen-dal-c0')
  })

  test('several Dishes: how many, then the Board and their titles, and it opens the Board', () => {
    const { title, body, url } = pushMessage({ board: BOARD, dishes: added(['Ada'], ['Linsen-Dal', 'Cremige Pilzpasta', 'Ofengemüse mit Tahini']) })

    expect(title).toBe('Ada hat 3 Gerichte hinzugefügt')
    expect(body).toBe('🍪 Kochclub: Linsen-Dal, Cremige Pilzpasta, Ofengemüse mit Tahini')
    expect(url).toBe('/b/kochclub')
  })

  test('up to three adders are all named, the latest first and the last joined with „und"', () => {
    expect(pushMessage({ board: BOARD, dishes: added(['Linus', 'Ada']) }).title).toBe('Linus und Ada haben 2 Gerichte hinzugefügt')
    expect(pushMessage({ board: BOARD, dishes: added(['Ada', 'Linus', 'Grace', 'Ada']) }).title).toBe('Ada, Linus und Grace haben 4 Gerichte hinzugefügt')
  })

  test('four or more adders: the latest two are named, the others counted', () => {
    expect(pushMessage({ board: BOARD, dishes: added(['Grace', 'Linus', 'Kati', 'Ada', 'Grace']) }).title)
      .toBe('Grace, Linus und 2 andere haben 5 Gerichte hinzugefügt')
  })

  test('a long list of titles ends with how many more, so the push stays small and no title is cut', () => {
    const titles = Array.from({ length: 40 }, (_, i) => `Ein ziemlich langes Gericht Nummer ${i}`)

    const { title, body } = pushMessage({ board: BOARD, dishes: added(['Ada'], titles) })

    expect(title).toBe('Ada hat 40 Gerichte hinzugefügt')
    expect(body).toBe('🍪 Kochclub: Ein ziemlich langes Gericht Nummer 0, Ein ziemlich langes Gericht Nummer 1 und 38 weitere')
  })

  test('one more is „1 weiteres"', () => {
    const titles = ['Ein langes Gericht mit vielen Zutaten', 'Noch ein langes Gericht mit Zutaten', 'Ein drittes ziemlich langes Gericht']
    expect(pushMessage({ board: BOARD, dishes: added(['Ada'], titles) }).body)
      .toBe('🍪 Kochclub: Ein langes Gericht mit vielen Zutaten, Noch ein langes Gericht mit Zutaten und 1 weiteres')
  })

  test('a first title too long on its own is cut to fit, the rest counted', () => {
    const { body } = pushMessage({ board: BOARD, dishes: added(['Ada'], ['x'.repeat(300), 'Dal']) })
    expect(body).toMatch(/^🍪 Kochclub: x+ … und 1 weiteres$/)
    expect(body.length).toBe(120)
  })

  test('the cut never splits an emoji', () => {
    const { body } = pushMessage({ board: BOARD, dishes: added(['Ada'], ['🍕'.repeat(150), 'Dal']) })
    expect(body).toMatch(/^🍪 Kochclub: (🍕)+ … und 1 weiteres$/u)
    expect(body.length).toBeLessThanOrEqual(120)
  })
})

describe('sending', () => {
  const vapid = { subject: 'mailto:push@example.com', publicKey: TEST_VAPID_PUBLIC_KEY, privateKey: 'JNU3GrAgBSIppqVi0CPJWJGluyMLazk2eUdxmB4gSEg' }
  const message = pushMessage({ board: BOARD, dishes: [{ title: 'Dal', code: 'ab12', addedBy: 'Ada' }] })

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
