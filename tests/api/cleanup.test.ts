import { utimes } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { CRON_SECRET, IMAGE_DIR, storedImages } from './server-env'
import { backdateDeletion } from './time-travel'

// The daily cleanup job (#195), as Vercel Cron calls it: GET
// /api/cron/cleanup with CRON_SECRET as a bearer token. It purges Dishes and
// Cookings deleted more than 30 days ago for good, then deletes every stored
// image nothing refers to any more that is older than a day. Here against
// the test server's disk storage.

interface Dish { id: string, imageUrl: string | null }
interface Board { id: string, columns: { dishes: Dish[] }[] }
interface Uploaded { url: string, ticket: string }

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

const runCleanup = (authorization: string | null = `Bearer ${CRON_SECRET}`) =>
  anonymous().fetch('/api/cron/cleanup', authorization ? { headers: { authorization } } : {})

function post(caller: Caller, path: string) {
  return caller.fetch(path, { method: 'POST' })
}

async function addDish(caller: Caller, boardId: string, body: Record<string, unknown> = {}): Promise<Dish> {
  const res = await postDish(caller, boardId, { title: 'Linsensuppe', placeholder: 'bowl', ...body })
  expect(res.status).toBe(201)
  return res.json()
}

const photo = () => sharp({ create: { width: 64, height: 48, channels: 3, background: '#a74' } }).jpeg().toBuffer()

async function uploadPhoto(caller: Caller, boardId: string): Promise<Uploaded> {
  const res = await caller.fetch(`/api/boards/${boardId}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(await photo()) })
  expect(res.status).toBe(201)
  return res.json()
}

// The stored file's name, from its URL (/images/dishes/<name>).
const fileOf = (url: string) => url.split('/').pop()!

// Makes a stored image `hours` older, as if it had been uploaded that long before.
async function backdateImage(url: string, hours: number): Promise<void> {
  const at = new Date(Date.now() - hours * 60 * 60 * 1000)
  await utimes(join(IMAGE_DIR, 'dishes', fileOf(url)), at, at)
}

test.each([
  ['no secret', null],
  ['a wrong secret', 'Bearer not-the-cron-secret-not-it'],
  ['the secret without "Bearer"', CRON_SECRET],
])('the job refuses a request with %s', async (_, authorization) => {
  expect((await runCleanup(authorization)).status).toBe(401)
})

test('the job is refused to a signed-in Member too', async () => {
  const ada = await signIn(ALLOWLISTED[39])
  expect((await ada.fetch('/api/cron/cleanup')).status).toBe(401)
})

test('an unreferenced image older than a day is deleted; a referenced one, or a newer one, is not', async () => {
  const stephanie = await signIn(ALLOWLISTED[39])
  const board = await landingBoard(stephanie)
  const used = await uploadPhoto(stephanie, board.id)
  await addDish(stephanie, board.id, { photo: used })
  const cancelled = await uploadPhoto(stephanie, board.id)
  const stillDeciding = await uploadPhoto(stephanie, board.id)
  await backdateImage(used.url, 48)
  await backdateImage(cancelled.url, 48)
  await backdateImage(stillDeciding.url, 23)

  expect((await runCleanup()).status).toBe(200)

  const left = await storedImages()
  expect(left).toContain(fileOf(used.url))
  expect(left).toContain(fileOf(stillDeciding.url))
  expect(left).not.toContain(fileOf(cancelled.url))
})

test('a Dish deleted more than 30 days ago is purged with its image; one deleted less long ago can still be restored', async () => {
  const stephanie = await signIn(ALLOWLISTED[39])
  const board = await landingBoard(stephanie)
  const old = await uploadPhoto(stephanie, board.id)
  const purged = await addDish(stephanie, board.id, { photo: old })
  const recent = await uploadPhoto(stephanie, board.id)
  const kept = await addDish(stephanie, board.id, { photo: recent })
  for (const dish of [purged, kept]) expect((await stephanie.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })).status).toBe(204)
  await backdateDeletion('dish', purged.id, 31)
  await backdateDeletion('dish', kept.id, 29)
  await backdateImage(old.url, 48)
  await backdateImage(recent.url, 48)

  expect((await runCleanup()).status).toBe(200)

  expect((await post(stephanie, `/api/dishes/${purged.id}/restore`)).status).toBe(404)
  expect((await post(stephanie, `/api/dishes/${kept.id}/restore`)).status).toBe(200)
  const left = await storedImages()
  expect(left).not.toContain(fileOf(old.url))
  expect(left).toContain(fileOf(recent.url))
})

test('a Cooking deleted more than 30 days ago is purged; one deleted less long ago can still be restored', async () => {
  const stephanie = await signIn(ALLOWLISTED[39])
  const board = await landingBoard(stephanie)
  const dish = await addDish(stephanie, board.id)
  const cookingIds: string[] = []
  for (let i = 0; i < 2; i++) {
    const cooked = await post(stephanie, `/api/dishes/${dish.id}/cook`)
    expect(cooked.status).toBe(200)
    cookingIds.push(((await cooked.json()) as { cooking: { id: string } }).cooking.id)
  }
  const [purged, kept] = cookingIds as [string, string]
  for (const id of cookingIds) expect((await stephanie.fetch(`/api/cookings/${id}`, { method: 'DELETE' })).status).toBe(204)
  await backdateDeletion('cooking', purged, 31)
  await backdateDeletion('cooking', kept, 29)

  expect((await runCleanup()).status).toBe(200)

  expect((await post(stephanie, `/api/cookings/${purged}/restore`)).status).toBe(404)
  expect((await post(stephanie, `/api/cookings/${kept}/restore`)).status).toBe(200)
})

test('a deleted Board’s images are deleted by the job', async () => {
  const stephanie = await signIn(ALLOWLISTED[39])
  const created = await stephanie.fetch('/api/boards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Weg damit', emoji: '🗑️' }) })
  expect(created.status).toBe(201)
  const board = await created.json() as { id: string }
  const uploaded = await uploadPhoto(stephanie, board.id)
  await addDish(stephanie, board.id, { photo: uploaded })
  expect((await stephanie.fetch(`/api/boards/${board.id}`, { method: 'DELETE' })).status).toBe(204)
  await backdateImage(uploaded.url, 48)

  expect((await runCleanup()).status).toBe(200)

  expect(await storedImages()).not.toContain(fileOf(uploaded.url))
})
