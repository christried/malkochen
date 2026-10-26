import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { createImageTickets } from '../../server/image-store/tickets'
import { testAuthEnv } from '../support/test-auth-env'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { startPushService, type PushService } from './push-service'
import { IMAGE_DIR, storedImages } from './server-env'

// Copies (#402; CONTEXT.md: Copy). "Kopieren" makes a new Dish on another
// of the user's Boards from one they can see: POST /api/dishes/:id/copy
// { boardId } answers it placed, on that Board's first Column that isn't
// Gekocht, added by the copier. It takes the title, Source, Creator, Caption,
// image, Focus Point and Placeholder; not the Cookings, Comments or Votes.
// Its image is a copy of the original's, so purging either Dish leaves the
// other's file. [160] owns both Boards made here, [161] copies, [162] is a
// Member of the target without "add Dishes", [163] is a Member of the source
// only. This file only.

const owner = () => signIn(ALLOWLISTED[160])
const copier = () => signIn(ALLOWLISTED[161])
const quiet = () => signIn(ALLOWLISTED[162])
const stranger = () => signIn(ALLOWLISTED[163])

const TIKTOK = 'https://www.tiktok.com/@kochmeister/video/7300000000000001'
const SECRET = testAuthEnv('http://127.0.0.1').BETTER_AUTH_SECRET ?? ''
const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) => caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })
const patch = (caller: Caller, path: string, body: unknown) => caller.fetch(path, { method: 'PATCH', ...json(body) })

let pushService: PushService
beforeAll(async () => {
  pushService = await startPushService()
  await Promise.all([owner(), copier(), quiet(), stranger()])
})
afterAll(() => pushService.close())
beforeEach(() => pushService.forget())

interface Column { id: string, name: string, isGekocht: boolean, dishes: Dish[] }
interface Dish {
  id: string
  title: string
  creator: string | null
  caption: string | null
  playableVideo: boolean | null
  imageUrl: string | null
  imageFocus: { x: number, y: number }
  placeholder: string
  placement?: { boardId: string, columnId: string, index: number }
  cookings: { id: string }[]
  votes: unknown[]
  commentCount: number
  addedBy: { id: string } | null
  source: { link: string, kind: string } | null
}
interface Board { id: string, slug: string, name: string, emoji: string, inviteToken: string, version: number, newDishIds: string[], columns: Column[] }

const getBoard = (caller: Caller, id: string): Promise<Board> => caller.fetch(`/api/boards/${id}`).then(res => res.json())
const idOf = async (caller: Caller): Promise<string> => (await (await caller.fetch('/api/me')).json() as { id: string }).id

async function newBoard(ada: Caller, name: string, members: Caller[]): Promise<Board> {
  const res = await post(ada, '/api/boards', { name, emoji: '🥘' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const { inviteToken } = await getBoard(ada, id)
  for (const member of members) expect((await post(member, `/api/invites/${inviteToken}/join`)).status).toBe(200)
  for (const caller of [ada, ...members]) expect((await post(caller, `/api/boards/${id}/open`)).status).toBe(204)
  return getBoard(ada, id)
}

// Quiet may see the target Board but not add Dishes to it.
async function sharedBoards(name: string) {
  const [ada, grace, linus, hedy] = await Promise.all([owner(), copier(), quiet(), stranger()])
  const source = await newBoard(ada, `${name} Quelle`, [grace, linus, hedy])
  const target = await newBoard(ada, `${name} Ziel`, [grace, linus])
  const linusId = await idOf(linus)
  expect((await patch(ada, `/api/boards/${target.id}/members/${linusId}/permissions`, { addDishes: false, editDishes: false })).status).toBe(200)
  return { source, target, ada, grace, linus, hedy }
}

// A Source ticket for what Source Lookup found for `link`, issued to `issuedTo`.
async function sourceTicket(issuedTo: Caller, link: string, caption: string | null, playableVideo: boolean): Promise<string> {
  return createImageTickets(SECRET, { purpose: 'source' }).issue(await idOf(issuedTo), JSON.stringify({ link, caption, playableVideo }))
}

async function addDish(caller: Caller, boardId: string, body: Record<string, unknown>): Promise<Dish> {
  const res = await postDish(caller, boardId, { title: 'Linsensuppe', placeholder: 'bowl', ...body })
  expect(res.status).toBe(201)
  return res.json()
}

async function uploadPhoto(caller: Caller, boardId: string): Promise<{ url: string, ticket: string }> {
  const bytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#4a7' } }).jpeg().toBuffer()
  const res = await caller.fetch(`/api/boards/${boardId}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(bytes) })
  expect(res.status).toBe(201)
  return res.json()
}

const copy = (caller: Caller, dishId: string, boardId: string) => post(caller, `/api/dishes/${dishId}/copy`, { boardId })
const fileOf = (url: string) => url.split('/').pop()!

test('a Copy takes the Dish’s fields, and not its Cookings, Comments or Votes; the copier added it', async () => {
  const { source, target, ada, grace } = await sharedBoards('Felder')
  const link = TIKTOK
  const original = await addDish(ada, source.id, {
    title: 'Omas Linsensuppe',
    placeholder: 'eintopf',
    source: { link },
    creator: 'Oma Gerda',
    caption: 'Die beste Linsensuppe der Welt',
    playableVideo: true,
    sourceTicket: await sourceTicket(ada, link, 'Die beste Linsensuppe der Welt', true),
  })
  expect((await post(ada, `/api/dishes/${original.id}/cook`)).status).toBe(200)

  const res = await copy(grace, original.id, target.id)
  expect(res.status).toBe(201)
  const { dish, board, imageCopied } = await res.json() as { dish: Dish, board: { id: string, slug: string, name: string, emoji: string }, imageCopied: boolean }

  expect(dish.id).not.toBe(original.id)
  expect(dish).toMatchObject({
    title: 'Omas Linsensuppe',
    placeholder: 'eintopf',
    creator: 'Oma Gerda',
    caption: 'Die beste Linsensuppe der Welt',
    playableVideo: true,
    source: { link, kind: 'tiktok' },
    cookings: [],
    votes: [],
    commentCount: 0,
    addedBy: { id: await idOf(grace) },
    placement: { boardId: target.id },
  })
  expect(board).toEqual({ id: target.id, slug: target.slug, name: target.name, emoji: target.emoji })
  expect(imageCopied).toBe(true)
  expect((await getBoard(ada, target.id)).columns.flatMap(c => c.dishes).map(d => d.id)).toContain(dish.id)
})

test('the Copy’s image is a copy of its own: purging the original leaves the Copy’s file', async () => {
  const { source, target, ada, grace } = await sharedBoards('Eigenes Bild')
  const photo = await uploadPhoto(ada, source.id)
  const original = await addDish(ada, source.id, { photo, imageFocus: { x: 20, y: 80 } })
  const bytes = await readFile(join(IMAGE_DIR, 'dishes', fileOf(photo.url)))

  const { dish } = await (await copy(grace, original.id, target.id)).json() as { dish: Dish }

  expect(dish.imageUrl).toMatch(/^\/images\/dishes\/[0-9a-f-]{36}\.jpg$/)
  expect(dish.imageUrl).not.toBe(original.imageUrl)
  expect(dish.imageFocus).toEqual({ x: 20, y: 80 })
  expect(await readFile(join(IMAGE_DIR, dish.imageUrl!.slice('/images/'.length)))).toEqual(bytes)

  expect((await ada.fetch(`/api/dishes/${original.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await post(ada, `/api/dishes/${original.id}/purge`)).status).toBe(204)

  expect(await storedImages()).not.toContain(fileOf(photo.url))
  expect(await storedImages()).toContain(fileOf(dish.imageUrl!))
  expect(await readFile(join(IMAGE_DIR, dish.imageUrl!.slice('/images/'.length)))).toEqual(bytes)
})

test('a Dish with its Placeholder only is copied with the same Placeholder and no image', async () => {
  const { source, target, grace } = await sharedBoards('Platzhalter')
  const original = await addDish(grace, source.id, { title: 'Ohne Bild', placeholder: 'wok' })

  const res = await copy(grace, original.id, target.id)
  const { dish, imageCopied } = await res.json() as { dish: Dish, imageCopied: boolean }

  expect(dish).toMatchObject({ title: 'Ohne Bild', placeholder: 'wok', imageUrl: null })
  expect(imageCopied).toBe(true)
})

test('a Copy lands in the first Column of the target that isn’t Gekocht, even when Gekocht comes first', async () => {
  const { source, target, ada, grace } = await sharedBoards('Spalten')
  const gekocht = target.columns.find(c => c.isGekocht)!
  const order = [gekocht.id, ...target.columns.filter(c => !c.isGekocht).map(c => c.id)]
  expect((await ada.fetch(`/api/boards/${target.id}/columns`, { method: 'PUT', ...json({ columnIds: order }) })).status).toBe(200)
  const original = await addDish(grace, source.id, { title: 'Spalte' })

  const { dish } = await (await copy(grace, original.id, target.id)).json() as { dish: Dish }

  const first = order.find(id => id !== gekocht.id)!
  expect(dish.placement).toMatchObject({ boardId: target.id, columnId: first })
  expect(first).not.toBe(gekocht.id)
})

test('refused: no "add Dishes" on the target, not a Member of it, a Dish not visible, an archived Dish, the same Board', async () => {
  const { source, target, ada, grace, linus, hedy } = await sharedBoards('Abgelehnt')
  const original = await addDish(grace, source.id, { title: 'Nein' })
  const before = (await getBoard(ada, target.id)).columns.flatMap(c => c.dishes).length

  expect((await copy(linus, original.id, target.id)).status).toBe(403)
  expect((await copy(hedy, original.id, target.id)).status).toBe(404)

  // Hedy's Board is not Grace's: a Dish on the target is not visible to Hedy (not a Member of it).
  const elsewhere = await newBoard(ada, 'Abgelehnt Privat', [])
  const hidden = await addDish(ada, elsewhere.id, { title: 'Privat' })
  expect((await copy(grace, hidden.id, target.id)).status).toBe(404)

  expect((await copy(grace, original.id, source.id)).status).toBe(400)
  expect((await copy(grace, '00000000-0000-4000-8000-000000000000', target.id)).status).toBe(404)

  expect((await ada.fetch(`/api/dishes/${original.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await copy(grace, original.id, target.id)).status).toBe(404)
  expect((await getBoard(ada, target.id)).columns.flatMap(c => c.dishes).length).toBe(before)
})

test('the target’s Board Version moves, the Copy is New Dish for its Members, and a Member with push on is notified', async () => {
  const { source, target, grace, linus } = await sharedBoards('Neu')
  const original = await addDish(grace, source.id, { title: 'Neues Gericht' })
  const linusDevice = pushService.device('linus-phone')
  expect((await linus.fetch('/api/me/push', { method: 'PUT', ...json(linusDevice.subscription) })).status).toBe(204)
  const versionBefore = (await getBoard(linus, target.id)).version

  const { dish } = await (await copy(grace, original.id, target.id)).json() as { dish: Dish }

  const seen = await getBoard(linus, target.id)
  expect(seen.version).toBeGreaterThan(versionBefore)
  expect(seen.newDishIds).toContain(dish.id)
  expect(pushService.deliveries.map(d => d.device)).toEqual(['linus-phone'])
  await linus.fetch('/api/me/push?endpoint=' + encodeURIComponent(linusDevice.subscription.endpoint), { method: 'DELETE' })
  expect(pushService.deliveries.at(-1)!.message.body).toContain('Neues Gericht')
})

test('the event log records a Dish copied with both Dishes, and no Dish added', async () => {
  const { source, target, grace } = await sharedBoards('Ereignis')
  const original = await addDish(grace, source.id, { title: 'Protokoll', source: { link: TIKTOK } })
  const events = await watchEvents()

  const { dish } = await (await copy(grace, original.id, target.id)).json() as { dish: Dish }

  // Push notifications are logged too (push_sent); only the Dish events here.
  const recorded = (await events.recorded()).filter(e => e.kind === 'dish_copied' || e.kind === 'dish_added')
  expect(recorded).toEqual([{
    kind: 'dish_copied',
    boardId: target.id,
    dishId: dish.id,
    userId: await idOf(grace),
    details: { from: original.id, source: 'tiktok' },
  }])
})
