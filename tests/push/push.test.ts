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
  test('a long list of Dish titles is cut, so the push stays small', () => {
    const dishes = Array.from({ length: 40 }, (_, i) => ({ title: `Ein ziemlich langes Gericht Nummer ${i}`, code: `c${i}`, addedBy: 'Ada' }))

    const { title, body, url } = pushMessage({ board: BOARD, dishes })

    expect(title).toBe('Ada hat 40 Gerichte zu 🍪 Kochclub hinzugefügt')
    expect(body.length).toBeLessThanOrEqual(122)
    expect(body).toMatch(/^Ein ziemlich langes Gericht Nummer 0, Ein ziemlich langes Gericht Nummer 1, .* …$/)
    expect(url).toBe('/b/kochclub')
  })

  test('three or more adders are listed, the last joined with „und"', () => {
    const dishes = ['Ada', 'Linus', 'Grace', 'Ada'].map((addedBy, i) => ({ title: `Gericht ${i}`, code: `c${i}`, addedBy }))
    expect(pushMessage({ board: BOARD, dishes }).title).toBe('Ada, Linus und Grace haben 4 Gerichte zu 🍪 Kochclub hinzugefügt')
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
