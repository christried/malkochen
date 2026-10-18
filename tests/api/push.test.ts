import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, speaking, type Caller } from './client'
import { startPushService, type Device, type PushService } from './push-service'

// Push notifications (#219): a Member turns them on per device in their
// settings (PUT /api/me/push stores that device's subscription, DELETE
// removes it). When a Member adds a Dish, every other Member of the Board who
// turned them on gets one notification per Board, replaced as more Dishes
// come in. The devices here subscribe on a fake push service, which keeps
// what the server pushed, decrypted. The users below are used by this file
// only.

const KATALIN = ALLOWLISTED[24]
const HYPATIA = ALLOWLISTED[25]
const MILEVA = ALLOWLISTED[26]
const INGE = ALLOWLISTED[28]
const VERA = ALLOWLISTED[42]

// A real browser's key, and an auth secret of the right length.
const P256DH = 'BPCfxKRCZj0q7rdmViuJLFJEjxRwx-HMi02GzIogk8vL_vKRTFN59vN5eienDkg3E4IAPZ4mYZLd2RyyL9CUSks'
const AUTH = 'AAAAAAAAAAAAAAAAAAAAAA'

interface Dish { id: string, code: string }
interface Board { id: string, slug: string, inviteToken: string, columns: { id: string, isGekocht: boolean }[] }

let pushService: PushService

beforeAll(async () => {
  pushService = await startPushService()
})

afterAll(() => pushService.close())

beforeEach(() => pushService.forget())

// Every device a test turned on is off again after it, so it gets nothing
// from the next test's Boards.
const turnedOn: { caller: Caller, device: Device }[] = []
afterEach(async () => {
  for (const { caller, device } of turnedOn.splice(0)) await turnOff(caller, device)
})

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const turnOn = (caller: Caller, device: Device) => caller.fetch('/api/me/push', json('PUT', device.subscription))
const turnOff = (caller: Caller, device: Device) => caller.fetch('/api/me/push', json('DELETE', { endpoint: device.subscription.endpoint }))

async function isOn(caller: Caller, device: Device): Promise<boolean> {
  const res = await caller.fetch(`/api/me/push?endpoint=${encodeURIComponent(device.subscription.endpoint)}`)
  expect(res.status).toBe(200)
  return (await res.json() as { on: boolean }).on
}

// A new device of the caller's, push turned on.
async function subscribed(caller: Caller, name: string): Promise<Device> {
  return turnedOnAt(caller, pushService.device(name))
}

async function turnedOnAt(caller: Caller, device: Device): Promise<Device> {
  expect((await turnOn(caller, device)).status).toBe(204)
  turnedOn.push({ caller, device })
  return device
}

const getBoard = (caller: Caller, id: string): Promise<Board> => caller.fetch(`/api/boards/${id}`).then(res => res.json())
const usernameOf = async (caller: Caller): Promise<string> => (await (await caller.fetch('/api/me')).json() as { name: string }).name

// A new Board of `owner`'s, with `members` joined, everyone having opened it.
async function sharedBoard(owner: Caller, members: Caller[], name: string, emoji: string): Promise<Board> {
  const res = await owner.fetch('/api/boards', json('POST', { name, emoji }))
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const { inviteToken } = await getBoard(owner, id)
  for (const member of members) {
    expect((await member.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  }
  for (const caller of [owner, ...members]) await open(caller, id)
  return getBoard(owner, id)
}

async function open(caller: Caller, boardId: string) {
  expect((await caller.fetch(`/api/boards/${boardId}/open`, { method: 'POST' })).status).toBe(204)
}

async function addDish(caller: Caller, boardId: string, title: string): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

const devicesReached = () => pushService.deliveries.map(d => d.device).toSorted()

test('push notifications are off for a device until it is turned on; each device is turned on and off by itself', async () => {
  const katalin = await signIn(KATALIN)
  const phone = pushService.device('katalin-phone')
  const laptop = pushService.device('katalin-laptop')
  expect(await isOn(katalin, phone)).toBe(false)

  await turnedOnAt(katalin, phone)
  await turnedOnAt(katalin, laptop)
  expect(await isOn(katalin, phone)).toBe(true)
  expect(await isOn(katalin, laptop)).toBe(true)

  expect((await turnOff(katalin, phone)).status).toBe(204)
  expect(await isOn(katalin, phone)).toBe(false)
  expect(await isOn(katalin, laptop)).toBe(true)

  // Turning it on again, or off when it is off, changes nothing.
  expect((await turnOn(katalin, laptop)).status).toBe(204)
  expect((await turnOff(katalin, phone)).status).toBe(204)
  expect(await isOn(katalin, laptop)).toBe(true)
  expect(await isOn(katalin, phone)).toBe(false)
})

test('a device another user turned on is not on for me, and I can\'t turn it off for them', async () => {
  const katalin = await signIn(KATALIN)
  const vera = await signIn(VERA)
  const phone = await subscribed(katalin, 'shared-phone')

  expect(await isOn(vera, phone)).toBe(false)
  expect((await turnOff(vera, phone)).status).toBe(204)
  expect(await isOn(katalin, phone)).toBe(true)

  // Signed in on it as Vera now, and turned on: it is Vera's.
  await turnedOnAt(vera, phone)
  expect(await isOn(vera, phone)).toBe(true)
  expect(await isOn(katalin, phone)).toBe(false)
})

test.each([
  ['no endpoint', { keys: { p256dh: P256DH, auth: AUTH } }],
  ['an endpoint that isn\'t a link', { endpoint: 'not a link', keys: { p256dh: P256DH, auth: AUTH } }],
  ['no keys', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }],
  ['a key that isn\'t one', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'short', auth: AUTH } }],
  ['an auth secret that isn\'t one', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: P256DH, auth: 'short' } }],
])('a subscription with %s is refused (400)', async (_, subscription) => {
  const katalin = await signIn(KATALIN)
  expect((await katalin.fetch('/api/me/push', json('PUT', subscription))).status).toBe(400)
})

test('only a signed-in user turns push notifications on or off', async () => {
  const device = pushService.device('nobodys')
  expect((await anonymous().fetch('/api/me/push', json('PUT', device.subscription))).status).toBe(401)
  expect((await anonymous().fetch('/api/me/push', json('DELETE', { endpoint: device.subscription.endpoint }))).status).toBe(401)
})

test('adding a Dish notifies every other Member who turned push on, on each of their devices, and nobody else', async () => {
  const katalin = await signIn(KATALIN, { name: 'Katalin Karikó' })
  const hypatia = await signIn(HYPATIA, { name: 'Hypatia' })
  const mileva = await signIn(MILEVA, { name: 'Mileva' })
  const inge = await signIn(INGE, { name: 'Inge' })
  const vera = await signIn(VERA, { name: 'Vera' })
  const board = await sharedBoard(katalin, [hypatia, mileva, inge], 'Notizen', '📝')
  await subscribed(katalin, 'katalin-own')
  await subscribed(hypatia, 'hypatia-phone')
  await subscribed(hypatia, 'hypatia-laptop')
  await subscribed(mileva, 'mileva-phone')
  // Not a Member of this Board.
  await subscribed(vera, 'vera-phone')
  // Inge is a Member, but never turned push on.

  await addDish(katalin, board.id, 'Linsensuppe')

  expect(devicesReached()).toEqual(['hypatia-laptop', 'hypatia-phone', 'mileva-phone'])
})

test('one notification per Board counts the Dishes added since the Member last opened it and names who added them', async () => {
  const katalin = await signIn(KATALIN, { name: 'Katalin Karikó' })
  const hypatia = await signIn(HYPATIA, { name: 'Hypatia' })
  const mileva = await signIn(MILEVA, { name: 'Mileva' })
  const [kati, mile] = [await usernameOf(katalin), await usernameOf(mileva)]
  const board = await sharedBoard(katalin, [hypatia, mileva], 'Kochclub', '🍪')
  await subscribed(hypatia, 'hypatia-kochclub')
  const tag = `board-${board.id}`

  // One Dish: it is named, and opening the notification opens it.
  const soup = await addDish(katalin, board.id, 'Omas Linsensuppe')
  expect(pushService.deliveries.map(d => d.message)).toEqual([{
    title: `${kati} hat Omas Linsensuppe hinzugefügt`,
    body: '🍪 Kochclub',
    tag,
    url: `/b/${board.slug}/omas-linsensuppe-${soup.code}`,
  }])

  // More of them, without Hypatia opening the Board: the same notification,
  // counting all of them, opens the Board.
  for (const title of ['Pilzpasta', 'Tofu-Nuggets', 'Dal', 'Ramen']) await addDish(katalin, board.id, title)
  expect(pushService.deliveries.at(-1)!.message).toEqual({
    title: `${kati} hat 5 Gerichte hinzugefügt`,
    body: '🍪 Kochclub: Ramen, Dal, Tofu-Nuggets, Pilzpasta, Omas Linsensuppe',
    tag,
    url: `/b/${board.slug}`,
  })
  expect(new Set(pushService.deliveries.map(d => d.message.tag))).toEqual(new Set([tag]))

  // Another Member adds one too: both are named, the latest first.
  await addDish(mileva, board.id, 'Shakshuka')
  expect(pushService.deliveries.at(-1)!.message.title).toBe(`${mile} und ${kati} haben 6 Gerichte hinzugefügt`)

  // Hypatia opens the Board: counting starts again.
  await open(hypatia, board.id)
  pushService.forget()
  const ramen = await addDish(mileva, board.id, 'Miso-Ramen')
  expect(pushService.deliveries.map(d => d.message)).toEqual([{
    title: `${mile} hat Miso-Ramen hinzugefügt`,
    body: '🍪 Kochclub',
    tag,
    url: `/b/${board.slug}/miso-ramen-${ramen.code}`,
  }])
})

test('a Dish added during the Tour notifies nobody, and is a New Dish for the other Members all the same', async () => {
  const katalin = await signIn(KATALIN)
  const hypatia = await signIn(HYPATIA)
  const board = await sharedBoard(katalin, [hypatia], 'Rundgang', '🧭')
  await subscribed(hypatia, 'hypatia-tour')

  const res = await postDish(katalin, board.id, { title: 'Probegericht', placeholder: 'bowl', tour: true })
  expect(res.status).toBe(201)
  const dish = await res.json() as Dish

  expect(pushService.deliveries).toEqual([])
  const seen = await getBoard(hypatia, board.id) as Board & { newDishIds: string[] }
  expect(seen.newDishIds).toEqual([dish.id])

  // Without the flag, as before.
  await addDish(katalin, board.id, 'Echtes Gericht')
  expect(devicesReached()).toEqual(['hypatia-tour'])
})

test('moving, editing, cooking or deleting a Dish notifies nobody', async () => {
  const katalin = await signIn(KATALIN)
  const hypatia = await signIn(HYPATIA)
  const board = await sharedBoard(katalin, [hypatia], 'Stille', '🤫')
  await subscribed(hypatia, 'hypatia-quiet')
  const dish = await addDish(katalin, board.id, 'Ruhige Suppe')
  pushService.forget()
  const gekocht = board.columns.find(c => c.isGekocht)!

  expect((await katalin.fetch(`/api/dishes/${dish.id}`, json('PATCH', { title: 'Leise Suppe' }))).status).toBe(200)
  expect((await katalin.fetch(`/api/dishes/${dish.id}/move`, json('POST', { columnId: gekocht.id }))).status).toBe(200)
  expect((await katalin.fetch(`/api/dishes/${dish.id}/cook`, { method: 'POST' })).status).toBe(200)
  expect((await katalin.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })).status).toBe(204)

  expect(pushService.deliveries).toEqual([])
})

test.each([404, 410])('a subscription the push service answers %i for is deleted; the Dish is added all the same', async (status) => {
  const katalin = await signIn(KATALIN)
  const hypatia = await signIn(HYPATIA)
  const board = await sharedBoard(katalin, [hypatia], `Abgelaufen ${status}`, '⌛')
  const expired = await subscribed(hypatia, `hypatia-expired-${status}`)
  const working = await subscribed(hypatia, `hypatia-working-${status}`)
  pushService.answer(expired, status)

  await addDish(katalin, board.id, 'Suppe')

  expect(await isOn(hypatia, expired)).toBe(false)
  expect(await isOn(hypatia, working)).toBe(true)
  expect(devicesReached()).toEqual([working.name])
})

test('a push that fails otherwise keeps the subscription and never breaks adding a Dish', async () => {
  const katalin = await signIn(KATALIN)
  const hypatia = await signIn(HYPATIA)
  const board = await sharedBoard(katalin, [hypatia], 'Störung', '⚡')
  const flaky = await subscribed(hypatia, 'hypatia-flaky')
  pushService.answer(flaky, 500)
  // A push service nobody answers at.
  const { subscription } = pushService.device('hypatia-unreachable')
  const unreachable = await turnedOnAt(hypatia, { name: 'hypatia-unreachable', subscription: { ...subscription, endpoint: 'http://127.0.0.1:9/push/hypatia-unreachable' } })

  await addDish(katalin, board.id, 'Suppe trotz allem')

  expect(await isOn(hypatia, flaky)).toBe(true)
  expect(await isOn(hypatia, unreachable)).toBe(true)
})

test('each Member is notified in their own language: their choice, else what their browser asked for last (#328)', async () => {
  const katalin = await signIn(KATALIN)
  const hypatia = await signIn(HYPATIA)
  // Mileva's browser asks for English.
  const mileva = speaking(await signIn(MILEVA), 'en-GB,en;q=0.9')
  const kati = await usernameOf(katalin)
  const board = await sharedBoard(katalin, [hypatia, mileva], 'Kochclub', '🍪')
  await subscribed(hypatia, 'hypatia-it')
  await subscribed(mileva, 'mileva-en')
  expect((await hypatia.fetch('/api/me/language', json('PUT', { language: 'it' }))).status).toBe(200)

  try {
    await addDish(katalin, board.id, 'Ramen')

    const titleOn = (device: string) => pushService.deliveries.find(d => d.device === device)!.message.title
    expect(titleOn('hypatia-it')).toBe(`${kati} ha aggiunto Ramen`)
    expect(titleOn('mileva-en')).toBe(`${kati} added Ramen`)
  }
  finally {
    await hypatia.fetch('/api/me/language', json('PUT', { language: 'auto' }))
  }
})
