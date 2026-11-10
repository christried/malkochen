import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { RATE_LIMITS } from '../../server/rate-limits'
import { ANONYMOUS_TIKTOK, BLOG, PASTA_TIKTOK, UNTITLED_TIKTOK } from '../support/source-lookup-fixtures'
import { startResendService, type ResendService } from '../support/resend-service'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, speaking, type Caller } from './client'
import { startPushService, type PushService } from './push-service'
import { CRON_SECRET, storedImages } from './server-env'
import { endLimitWindow, useUpLimit } from './time-travel'

// A Dish added offline (#462; CONTEXT.md: Unsent Change; ADR 0012) arrives as
// POST /api/boards/:id/dishes with `offline: true`: a link as pasted, maybe a
// title, the Placeholder Image and the id the device made. The server looks
// the link up now (the test servers answer the links in
// tests/support/source-lookup-fixtures.ts), keeps the Dish whatever the rate
// limits say, and tells which Dish was on the Board with that link already.
// Users 204 to 209 are used by this file only: Lovelace-sized Boards of their own.

const owner = ALLOWLISTED[204]
const joiner = ALLOWLISTED[205]
const watcher = ALLOWLISTED[206]
const limited = ALLOWLISTED[207]
const outsider = ALLOWLISTED[208]

interface Dish {
  id: string
  title: string
  creator: string | null
  caption: string | null
  imageUrl: string | null
  placeholder: string
  source: { link: string, kind: string } | null
  placement: { boardId: string, columnId: string, index: number }
  duplicateOf?: { id: string, title: string, columnName: string }
}
interface Board {
  id: string
  slug: string
  inviteToken: string
  members: { id: string, name: string }[]
  columns: { id: string, name: string, dishes: Dish[] }[]
  newDishIds: string[]
}

const open = async (caller: Caller, boardId: string) =>
  expect((await caller.fetch(`/api/boards/${boardId}/open`, json('POST'))).status).toBe(204)

const json = (method: string, body?: unknown): RequestInit =>
  ({ method, ...body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } })
const getBoard = async (caller: Caller, id: string): Promise<Board> => (await caller.fetch(`/api/boards/${id}`)).json()

async function newBoard(caller: Caller, name: string, members: Caller[] = []): Promise<Board> {
  const res = await caller.fetch('/api/boards', json('POST', { name, emoji: '📶' }))
  expect(res.status).toBe(201)
  const { id, inviteToken } = await getBoard(caller, (await res.json() as { id: string }).id)
  for (const member of members) expect((await member.fetch(`/api/invites/${inviteToken}/join`, json('POST'))).status).toBe(200)
  return getBoard(caller, id)
}

// What the device sends for a Dish added offline.
const lateAdd = (body: { title?: string, link?: string, id?: string }) => ({
  offline: true,
  id: body.id ?? randomUUID(),
  placeholder: 'ramen',
  ...body.title !== undefined && { title: body.title },
  ...body.link !== undefined && { source: { link: body.link } },
})

async function addLate(caller: Caller, boardId: string, body: Parameters<typeof lateAdd>[0]): Promise<Dish> {
  const res = await postDish(caller, boardId, lateAdd(body))
  expect(res.status).toBe(201)
  return res.json()
}

const dishesOf = async (caller: Caller, boardId: string) => (await getBoard(caller, boardId)).columns.flatMap(c => c.dishes)

let push: PushService
let resend: ResendService
beforeAll(async () => {
  push = await startPushService()
  resend = await startResendService()
})
afterAll(async () => {
  await push.close()
  await resend.close()
})

test('the link is looked up on arrival: image, Creator and Caption fill in, the typed title stays', async () => {
  const caller = await signIn(owner)
  const board = await newBoard(caller, 'Unterwegs')
  const imagesBefore = await storedImages()

  const dish = await addLate(caller, board.id, { title: 'Meine Pilzpasta', link: PASTA_TIKTOK })

  expect(dish).toMatchObject({
    title: 'Meine Pilzpasta',
    creator: '@mara.kocht',
    caption: 'Pilzpasta in 15 Minuten',
    source: { link: PASTA_TIKTOK, kind: 'tiktok' },
    placeholder: 'ramen',
  })
  expect(dish.imageUrl).toMatch(/^\/images\/dishes\//)
  // The image is the Source's, copied into the Image Store and readable.
  const image = await anonymous().fetch(dish.imageUrl!)
  expect(image.status).toBe(200)
  expect(image.headers.get('content-type')).toMatch(/^image\//)
  expect((await storedImages()).length).toBe(imagesBefore.length + 1)
  // At the top of the first Column.
  expect(dish.placement).toMatchObject({ boardId: board.id, columnId: board.columns[0]!.id, index: 0 })
})

test.each([
  ['no title', undefined],
  ['an empty title', '   '],
])('%s: the Suggested Title the Source showed becomes the title', async (_, title) => {
  const caller = await signIn(owner)
  const board = await newBoard(caller, 'Titel')
  expect((await addLate(caller, board.id, { title, link: PASTA_TIKTOK })).title).toBe('Cremige Pilzpasta')
})

test.each([
  ['German', undefined, 'TikTok von @mara.kocht', 'TikTok-Video'],
  ['English', 'en', 'TikTok by @mara.kocht', 'TikTok video'],
  ['Italian', 'it', 'TikTok di @mara.kocht', 'Video TikTok'],
])('a Source with no title is titled after its platform and Creator in the adder\'s language (%s)', async (_, language, withCreator, without) => {
  const caller = await signIn(owner)
  const speaker = language ? speaking(caller, language) : caller
  const board = await newBoard(caller, 'Sprache')
  expect((await addLate(speaker, board.id, { link: UNTITLED_TIKTOK })).title).toBe(withCreator)
  expect((await addLate(speaker, board.id, { link: ANONYMOUS_TIKTOK })).title).toBe(without)
})

test('a web page with no Creator is titled after its site, one with a Creator after it', async () => {
  const caller = await signIn(owner)
  const board = await newBoard(caller, 'Blog')
  expect((await addLate(caller, board.id, { link: BLOG })).title).toBe('Rezept von Kochblog')
  expect((await addLate(caller, board.id, { link: 'https://bare.example/seite' })).title).toBe('bare.example')
})

test('a link nothing is known of is added with its Placeholder Image and a title made from it', async () => {
  const caller = await signIn(owner)
  const board = await newBoard(caller, 'Unbekannt')
  const dish = await addLate(caller, board.id, { link: 'http://127.0.0.1/rezept' })
  expect(dish).toMatchObject({ title: '127.0.0.1', imageUrl: null, creator: null })
})

test('a Dish added by hand, with a title and no link, is added as it is', async () => {
  const caller = await signIn(owner)
  const board = await newBoard(caller, 'Von Hand')
  const dish = await addLate(caller, board.id, { title: 'Omas Linsensuppe' })
  expect(dish).toMatchObject({ title: 'Omas Linsensuppe', source: null, imageUrl: null, creator: null, placeholder: 'ramen' })
})

test.each([
  ['neither a title nor a link', { id: randomUUID(), placeholder: 'ramen', offline: true }],
  ['a blank title and no link', { id: randomUUID(), placeholder: 'ramen', offline: true, title: '  ' }],
  ['no id', { placeholder: 'ramen', offline: true, title: 'Dal' }],
  ['no Placeholder Image', { id: randomUUID(), offline: true, title: 'Dal' }],
])('a body with %s is refused', async (_, body) => {
  const caller = await signIn(owner)
  const board = await newBoard(caller, 'Zu wenig')
  expect((await postDish(caller, board.id, body)).status).toBe(400)
  expect(await dishesOf(caller, board.id)).toEqual([])
})

test('a repeat of the same device-made id records once and answers the same', async () => {
  const caller = await signIn(owner)
  const board = await newBoard(caller, 'Doppelt')
  const body = lateAdd({ link: PASTA_TIKTOK })

  const first = await (await postDish(caller, board.id, body)).json() as Dish
  const imagesAfterFirst = await storedImages()
  const again = await postDish(caller, board.id, body)

  expect(again.status).toBe(201)
  expect(await again.json()).toEqual(first)
  expect(await dishesOf(caller, board.id)).toHaveLength(1)
  expect(await storedImages()).toEqual(imagesAfterFirst)
})

test('an id another user\'s Dish has is refused', async () => {
  const caller = await signIn(owner)
  const other = await signIn(joiner)
  const board = await newBoard(caller, 'Fremde Id', [other])
  const theirs = await addLate(caller, board.id, { title: 'Dal' })
  expect((await postDish(other, board.id, lateAdd({ id: theirs.id, title: 'Reis' }))).status).toBe(409)
})

test('a Source already on the Board is added all the same, and the answer names the Dish that had it', async () => {
  const caller = await signIn(owner)
  const board = await newBoard(caller, 'Schon da')
  const first = await addLate(caller, board.id, { link: PASTA_TIKTOK })
  expect(first.duplicateOf).toBeUndefined()

  const second = await addLate(caller, board.id, { link: PASTA_TIKTOK })

  expect(second.id).not.toBe(first.id)
  expect(second.duplicateOf).toEqual({ id: first.id, code: expect.any(String), title: first.title, columnName: 'Ideen' })
  expect(await dishesOf(caller, board.id)).toHaveLength(2)
})

test('the caller\'s permission is checked: a stranger gets 404, a Member without "add Dishes" 403, and nothing is added', async () => {
  const caller = await signIn(owner)
  const member = await signIn(joiner)
  const stranger = await signIn(outsider)
  const board = await newBoard(caller, 'Rechte', [member])
  const ownerId = (await (await caller.fetch('/api/me')).json() as { id: string }).id
  const memberId = board.members.find(m => m.id !== ownerId)!.id
  expect((await caller.fetch(`/api/boards/${board.id}/members/${memberId}/permissions`, json('PATCH', { addDishes: false }))).status).toBe(200)
  const imagesBefore = await storedImages()

  expect((await postDish(stranger, board.id, lateAdd({ link: PASTA_TIKTOK }))).status).toBe(404)
  const refused = await postDish(member, board.id, lateAdd({ link: PASTA_TIKTOK }))
  expect(refused.status).toBe(403)
  expect((await refused.json()).data).toEqual({ permission: 'addDishes' })
  expect((await postDish(anonymous(), board.id, lateAdd({ title: 'Dal' }))).status).toBe(401)

  expect(await dishesOf(caller, board.id)).toEqual([])
  expect(await storedImages()).toEqual(imagesBefore)
})

test('it is a New Dish for the others, never for the adder, goes by arrival, and notifies', async () => {
  const caller = await signIn(owner)
  const member = await signIn(joiner)
  const board = await newBoard(caller, 'Neu', [member])
  await open(member, board.id)
  await open(caller, board.id)
  const device = push.device('late-add-joiner')
  expect((await member.fetch('/api/me/push', json('PUT', device.subscription))).status).toBe(204)
  push.forget()

  const dish = await addLate(caller, board.id, { title: 'Ofengemüse' })

  await open(member, board.id)
  await open(caller, board.id)
  expect((await getBoard(member, board.id)).newDishIds).toEqual([dish.id])
  expect((await getBoard(caller, board.id)).newDishIds).toEqual([])
  expect(push.deliveries.map(d => d.device)).toEqual(['late-add-joiner'])
  expect(push.deliveries[0]!.message.body).toBe('Ofengemüse')
  await member.fetch('/api/me/push', json('DELETE', { endpoint: device.subscription.endpoint }))
})

test('it is in the Email Digest of a Member who switched it on', async () => {
  const caller = await signIn(owner)
  const member = await signIn(watcher)
  const board = await newBoard(caller, 'Digest', [member])
  expect((await member.fetch('/api/me/email-digest', { method: 'PUT' })).status).toBe(204)
  // Whatever is in the digest from earlier runs is gone with this one.
  await anonymous().fetch('/api/cron/email-digest', { headers: { authorization: `Bearer ${CRON_SECRET}` } })
  resend.forget()

  await addLate(caller, board.id, { title: 'Spätzle' })
  expect((await anonymous().fetch('/api/cron/email-digest', { headers: { authorization: `Bearer ${CRON_SECRET}` } })).status).toBe(200)

  const mine = resend.sent.filter(e => e.to.includes(watcher))
  expect(mine).toHaveLength(1)
  expect(mine[0]!.text).toContain('Spätzle')
  await member.fetch('/api/me/email-digest', { method: 'DELETE' })
})

test('over the lookup limit a late add is added without the lookup, never answered 429', async () => {
  const caller = await signIn(limited)
  const board = await newBoard(caller, 'Lookup-Limit')
  await useUpLimit(limited, 'source-lookup', RATE_LIMITS['source-lookup'].calls)

  const res = await postDish(caller, board.id, lateAdd({ link: PASTA_TIKTOK }))

  expect(res.status).toBe(201)
  // Nothing was looked up: no Creator, no Suggested Title, no image.
  expect(await res.json()).toMatchObject({ title: 'TikTok-Video', creator: null, imageUrl: null, source: { kind: 'tiktok' } })
  await endLimitWindow(limited, 'source-lookup')
})

test('over the add limit a late add is added without copying the image, never answered 429', async () => {
  const caller = await signIn(limited)
  const board = await newBoard(caller, 'Add-Limit')
  await useUpLimit(limited, 'add-dish', RATE_LIMITS['add-dish'].calls)
  const imagesBefore = await storedImages()

  const res = await postDish(caller, board.id, lateAdd({ link: PASTA_TIKTOK }))

  expect(res.status).toBe(201)
  // Looked up (title, Creator), but its image was not copied.
  expect(await res.json()).toMatchObject({ title: 'Cremige Pilzpasta', creator: '@mara.kocht', imageUrl: null })
  expect(await storedImages()).toEqual(imagesBefore)
  await endLimitWindow(limited, 'add-dish')
})
