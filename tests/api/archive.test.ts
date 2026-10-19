import sharp from 'sharp'
import { expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { CRON_SECRET, storedImages } from './server-env'
import { backdateDeletion } from './time-travel'

// Archived Dishes (#336; CONTEXT.md: Archived Dish). Archiving a Dish
// (DELETE /api/dishes/:id) takes it off its Board into the Board's Archive
// for 30 days: GET /api/boards/:id/archive lists it with who archived it
// and when. Any Member restores it (POST /api/dishes/:id/restore); the Owner
// deletes it for good sooner (POST /api/dishes/:id/purge), with its image.
// Cecilia owns the Boards made here, Edith joins them, Lynn is the outsider;
// all three are used by this file only.

interface Person { id: string, name: string }
interface Cooking { id: string }
interface Dish { id: string, title: string, imageUrl: string | null, cookings: Cooking[] }
interface Column { id: string, name: string, isGekocht: boolean, dishes: Dish[] }
interface Board { id: string, inviteToken: string, columns: Column[] }
interface ArchivedDish {
  id: string
  title: string
  imageUrl: string | null
  placeholder: string
  archivedAt: string
  archivedBy: Person | null
  purgesAt: string
}
interface Uploaded { url: string, ticket: string }

const owner = () => signIn(ALLOWLISTED[43])
const member = () => signIn(ALLOWLISTED[44])
const outsider = () => signIn(ALLOWLISTED[45])

const DAY_MS = 24 * 60 * 60 * 1000

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) =>
  caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

// A new Board of Cecilia's, with Edith joined through its Invite Link.
async function sharedBoard(name: string): Promise<{ board: Board, cecilia: Caller, edith: Caller }> {
  const [cecilia, edith] = await Promise.all([owner(), member()])
  const res = await post(cecilia, '/api/boards', { name, emoji: '🗃️' })
  expect(res.status).toBe(201)
  const board = await getBoard(cecilia, (await res.json() as { id: string }).id)
  expect((await post(edith, `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  return { board, cecilia, edith }
}

async function addDish(caller: Caller, boardId: string, title: string, extra: Record<string, unknown> = {}): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl', ...extra })
  expect(res.status).toBe(201)
  return res.json()
}

const archive = (caller: Caller, dishId: string) => caller.fetch(`/api/dishes/${dishId}`, { method: 'DELETE' })
const restore = (caller: Caller, dishId: string) => post(caller, `/api/dishes/${dishId}/restore`)
const purge = (caller: Caller, dishId: string) => post(caller, `/api/dishes/${dishId}/purge`)

async function archiveOf(caller: Caller, boardId: string): Promise<ArchivedDish[]> {
  const res = await caller.fetch(`/api/boards/${boardId}/archive`)
  expect(res.status).toBe(200)
  return ((await res.json()) as { dishes: ArchivedDish[] }).dishes
}

const idsIn = async (caller: Caller, boardId: string, columnId: string) =>
  (await getBoard(caller, boardId)).columns.find(c => c.id === columnId)!.dishes.map(d => d.id)

async function uploadPhoto(caller: Caller, boardId: string): Promise<Uploaded> {
  const bytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#4a7' } }).jpeg().toBuffer()
  const res = await caller.fetch(`/api/boards/${boardId}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(bytes) })
  expect(res.status).toBe(201)
  return res.json()
}

const fileOf = (url: string) => url.split('/').pop()!

test('an archived Dish is in its Board’s Archive, with who archived it, when, and when it goes for good', async () => {
  const { board, cecilia, edith } = await sharedBoard('Archiv')
  const older = await addDish(cecilia, board.id, 'Shakshuka')
  const newer = await addDish(cecilia, board.id, 'Ramen')
  const before = Date.now()

  expect((await archive(cecilia, older.id)).status).toBe(204)
  expect((await archive(edith, newer.id)).status).toBe(204)

  // Newest archived first, the same for every Member.
  const listed = await archiveOf(cecilia, board.id)
  expect(await archiveOf(edith, board.id)).toEqual(listed)
  expect(listed.map(d => d.title)).toEqual(['Ramen', 'Shakshuka'])
  const [ramen, shakshuka] = listed as [ArchivedDish, ArchivedDish]
  expect(ramen).toMatchObject({ id: newer.id, placeholder: 'bowl', imageUrl: null, archivedBy: { id: await idOf(edith) } })
  expect(shakshuka.archivedBy).toMatchObject({ id: await idOf(cecilia), name: expect.any(String) })
  const archivedAt = new Date(ramen.archivedAt).getTime()
  expect(archivedAt).toBeGreaterThanOrEqual(before - 5000)
  // 30 calendar days, as the cleanup counts them: an hour more or less
  // across a change of daylight saving time.
  expect(Math.abs(new Date(ramen.purgesAt).getTime() - archivedAt - 30 * DAY_MS)).toBeLessThanOrEqual(60 * 60 * 1000)
})

test('the Archive is only for Members of the Board, and an empty one lists nothing', async () => {
  const { board, cecilia } = await sharedBoard('Leeres Archiv')
  const lynn = await outsider()

  expect(await archiveOf(cecilia, board.id)).toEqual([])
  expect((await lynn.fetch(`/api/boards/${board.id}/archive`)).status).toBe(404)
  expect((await cecilia.fetch('/api/boards/not-a-board/archive')).status).toBe(404)
})

test('any Member restores an archived Dish: back in its Column, at its place, out of the Archive', async () => {
  const { board, cecilia, edith } = await sharedBoard('Zurück')
  const ideen = board.columns[0]!
  const bottom = await addDish(cecilia, board.id, 'Linsensuppe')
  const middle = await addDish(cecilia, board.id, 'Apfelkuchen')
  const top = await addDish(cecilia, board.id, 'Pad Thai')
  await archive(cecilia, middle.id)
  const added = await addDish(cecilia, board.id, 'Tacos')

  const res = await restore(edith, middle.id)

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: middle.id, placement: { boardId: board.id, columnId: ideen.id, index: 2 } })
  expect(await idsIn(cecilia, board.id, ideen.id)).toEqual([added.id, top.id, middle.id, bottom.id])
  expect(await archiveOf(cecilia, board.id)).toEqual([])
})

test('a Dish whose Column was deleted meanwhile comes back at the top of the first Column that isn’t Gekocht', async () => {
  const { board, cecilia } = await sharedBoard('Spalte weg')
  const [ideen, dieseWoche] = board.columns as [Column, Column]
  const gekocht = board.columns.find(c => c.isGekocht)!
  const archived = await addDish(cecilia, board.id, 'Wandert')
  const live = await addDish(cecilia, board.id, 'Bleibt')
  for (const dish of [archived, live]) await post(cecilia, `/api/dishes/${dish.id}/move`, { columnId: dieseWoche.id })
  await archive(cecilia, archived.id)
  // Its live Dishes go to Gekocht; the archived one waits in the Archive.
  expect((await cecilia.fetch(`/api/columns/${dieseWoche.id}?moveTo=${gekocht.id}`, { method: 'DELETE' })).status).toBe(204)
  expect(await idsIn(cecilia, board.id, gekocht.id)).toEqual([live.id])
  expect((await archiveOf(cecilia, board.id)).map(d => d.id)).toEqual([archived.id])
  // Added after the Column went: the restored Dish still comes back above it.
  const later = await addDish(cecilia, board.id, 'Später')

  const res = await restore(cecilia, archived.id)

  expect(res.status).toBe(200)
  expect((await res.json() as { placement: unknown }).placement).toEqual({ boardId: board.id, columnId: ideen.id, index: 0 })
  expect(await idsIn(cecilia, board.id, ideen.id)).toEqual([archived.id, later.id])
})

test('a restored Dish keeps its Cookings', async () => {
  const { board, cecilia, edith } = await sharedBoard('Gekochtes')
  const dish = await addDish(cecilia, board.id, 'Curry')
  for (let i = 0; i < 2; i++) expect((await post(cecilia, `/api/dishes/${dish.id}/cook`)).status).toBe(200)
  await archive(cecilia, dish.id)

  const restored = await (await restore(edith, dish.id)).json() as Dish

  expect(restored.cookings).toHaveLength(2)
})

test('an archived Dish is left out of search and the Board’s Dish count', async () => {
  const { board, cecilia } = await sharedBoard('Versteckt')
  const dish = await addDish(cecilia, board.id, 'Verstecktes Gulasch')
  const count = async () => ((await (await cecilia.fetch('/api/boards')).json()) as { id: string, dishCount: number }[]).find(b => b.id === board.id)!.dishCount
  const search = async () => ((await (await cecilia.fetch(`/api/boards/${board.id}/dishes?q=gulasch`)).json()) as { dishes: Dish[] }).dishes.map(d => d.id)
  expect(await count()).toBe(1)
  expect(await search()).toEqual([dish.id])

  await archive(cecilia, dish.id)

  expect(await count()).toBe(0)
  expect(await search()).toEqual([])
})

test('the Owner deletes an archived Dish for good, with its image, at once', async () => {
  const { board, cecilia } = await sharedBoard('Endgültig')
  const photo = await uploadPhoto(cecilia, board.id)
  const dish = await addDish(cecilia, board.id, 'Weg damit', { photo })
  expect(await storedImages()).toContain(fileOf(photo.url))
  await archive(cecilia, dish.id)

  expect((await purge(cecilia, dish.id)).status).toBe(204)

  expect(await archiveOf(cecilia, board.id)).toEqual([])
  expect(await storedImages()).not.toContain(fileOf(photo.url))
  expect((await restore(cecilia, dish.id)).status).toBe(404)
  expect((await purge(cecilia, dish.id)).status).toBe(404)
})

test('only the Owner deletes for good, only an archived Dish, and only on their Board', async () => {
  const { board, cecilia, edith } = await sharedBoard('Nicht du')
  const lynn = await outsider()
  const dish = await addDish(edith, board.id, 'Von Edith')

  // A Dish on the Board isn't in the Archive.
  expect((await purge(cecilia, dish.id)).status).toBe(404)
  await archive(edith, dish.id)
  expect((await purge(edith, dish.id)).status).toBe(403)
  expect((await purge(lynn, dish.id)).status).toBe(404)
  for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-dish']) expect((await purge(cecilia, id)).status).toBe(404)

  expect((await archiveOf(cecilia, board.id)).map(d => d.id)).toEqual([dish.id])
})

test('an archived Dish goes from the Archive after 30 days', async () => {
  const { board, cecilia } = await sharedBoard('Dreißig Tage')
  const kept = await addDish(cecilia, board.id, 'Bleibt noch')
  const purged = await addDish(cecilia, board.id, 'Ist weg')
  for (const dish of [kept, purged]) await archive(cecilia, dish.id)
  await backdateDeletion('dish', kept.id, 29)
  await backdateDeletion('dish', purged.id, 31)

  expect((await anonymous().fetch('/api/cron/cleanup', { headers: { authorization: `Bearer ${CRON_SECRET}` } })).status).toBe(200)

  const left = await archiveOf(cecilia, board.id)
  expect(left.map(d => d.id)).toEqual([kept.id])
  // A day left, give or take the test's own seconds.
  expect(Math.round((new Date(left[0]!.purgesAt).getTime() - Date.now()) / DAY_MS)).toBe(1)
})

test('archiving, restoring and deleting for good are each recorded, without content', async () => {
  const { board, cecilia, edith } = await sharedBoard('Protokoll')
  const dish = await addDish(cecilia, board.id, 'Geheimes Rezept')
  const [ceciliaId, edithId] = await Promise.all([idOf(cecilia), idOf(edith)])
  const events = await watchEvents()

  await archive(edith, dish.id)
  await restore(cecilia, dish.id)
  await archive(cecilia, dish.id)
  await purge(cecilia, dish.id)
  // Refused, so not recorded.
  await purge(cecilia, dish.id)

  expect(await events.recorded()).toEqual([
    { kind: 'dish_archived', boardId: board.id, dishId: dish.id, userId: edithId, details: null },
    { kind: 'dish_restored', boardId: board.id, dishId: dish.id, userId: ceciliaId, details: null },
    { kind: 'dish_archived', boardId: board.id, dishId: dish.id, userId: ceciliaId, details: null },
    { kind: 'dish_deleted', boardId: board.id, dishId: dish.id, userId: ceciliaId, details: null },
  ])
})
