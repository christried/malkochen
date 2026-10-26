import pg from 'pg'
import sharp from 'sharp'
import { beforeAll, expect, inject, test } from 'vitest'
import { RATE_LIMITS, type RateLimited } from '../../server/rate-limits'
import { BOARDS_PER_USER } from '../../shared/board'
import { landingBoard, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { endLimitWindow, useUpLimit } from './time-travel'

// What one user may do of the costly things per window (server/rate-limits.ts):
// over the limit a call answers 429 until the window is over. Each test uses
// up all but the last call of the window in the database, as if the user had
// made them, instead of making them all.

const rachel = ALLOWLISTED[36]
const mae = ALLOWLISTED[37]

const photo = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#7a4' } }).jpeg().toBuffer()

function sendPhoto(caller: Caller, path: string, bytes: Uint8Array) {
  return caller.fetch(path, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(bytes) })
}

const lookUp = (c: Caller) => c.fetch(`/api/source-lookup?${new URLSearchParams({ link: 'http://127.0.0.1/rezept' })}`)
const ownPhoto = async (c: Caller) => sendPhoto(c, `/api/boards/${(await landingBoard(c)).id}/photos`, await photo())
const profilePicture = async (c: Caller) => sendPhoto(c, '/api/me/pictures', await photo())

// Rachel's Dish whose image is reloaded, added before any limit is used up.
let reloadedDish = ''
beforeAll(async () => {
  const c = await signIn(rachel)
  const added = await postDish(c, (await landingBoard(c)).id, { title: 'Dal', placeholder: 'bowl' })
  reloadedDish = (await added.json() as { id: string }).id
})

// "Bild neu laden": the image found for the Dish's link, copied. The ticket
// is no good, so nothing is copied, but the call counts all the same.
function reloadImage(c: Caller) {
  return c.fetch(`/api/dishes/${reloadedDish}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageUrl: 'https://bilder.example/dal.jpg', imageTicket: 'no-good' }),
  })
}

// Each limited call, made once, with what it answers when it goes through.
const calls: [string, RateLimited, number, (caller: Caller) => Promise<Response>][] = [
  ['Source Lookup', 'source-lookup', 200, lookUp],
  ['an Own Photo', 'upload', 201, ownPhoto],
  ['a Profile Picture', 'upload', 201, profilePicture],
  ['adding a Dish', 'add-dish', 201, async c => postDish(c, (await landingBoard(c)).id, { title: 'Dal', placeholder: 'bowl' })],
  ['"Bild neu laden"', 'add-dish', 200, reloadImage],
  ['creating a Board', 'create-board', 201, c => c.fetch('/api/boards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Noch ein Board', emoji: '🥕' }),
  })],
]

test.each(calls)('%s answers 429 over the limit, and works again in the next window', async (_, limited, ok, call) => {
  const user = await signIn(rachel)
  await useUpLimit(rachel, limited, RATE_LIMITS[limited].calls - 1)

  expect((await call(user)).status).toBe(ok)
  expect((await call(user)).status).toBe(429)

  await endLimitWindow(rachel, limited)
  expect((await call(user)).status).toBe(ok)
})

test('one user over a limit doesn\'t limit another', async () => {
  const [over, other] = [await signIn(rachel), await signIn(mae)]
  await useUpLimit(rachel, 'source-lookup', RATE_LIMITS['source-lookup'].calls)

  expect((await lookUp(over)).status).toBe(429)
  expect((await lookUp(other)).status).toBe(200)

  await endLimitWindow(rachel, 'source-lookup')
})

test('Own Photos and Profile Pictures share one limit', async () => {
  const user = await signIn(rachel)
  await useUpLimit(rachel, 'upload', RATE_LIMITS.upload.calls - 1)

  expect((await ownPhoto(user)).status).toBe(201)
  expect((await profilePicture(user)).status).toBe(429)

  await endLimitWindow(rachel, 'upload')
})

// Boards per user (#347): at most BOARDS_PER_USER Boards of their own,
// refused at creation (409) until they delete one. Boards they're a Member
// of don't count. Mendel is used by this test only.
test('a user with BOARDS_PER_USER Boards of their own can create another only once one is deleted', async () => {
  const mendel = ALLOWLISTED[127]
  const user = await signIn(mendel)
  await landingBoard(user) // their first Board, made on landing
  const newBoard = () => user.fetch('/api/boards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Noch ein Board', emoji: '🥕' }),
  })
  const ids: string[] = []
  for (let owned = 1; owned < BOARDS_PER_USER; owned++) {
    const created = await newBoard()
    expect(created.status).toBe(201)
    ids.push((await created.json() as { id: string }).id)
  }
  // Their daily limit on creating Boards is a different one.
  await endLimitWindow(mendel, 'create-board')

  const refused = await newBoard()
  expect(refused.status).toBe(409)
  expect(await refused.json()).toMatchObject({ statusMessage: 'Too many Boards' })

  expect((await user.fetch(`/api/boards/${ids[0]}`, { method: 'DELETE' })).status).toBe(204)
  expect((await newBoard()).status).toBe(201)
})

// Better Auth limits requests per IP address. Kept in the database, not in
// each server instance's memory, its counts hold across instances.
test('Better Auth counts requests in the database', async () => {
  await (await signIn(rachel)).fetch('/api/auth/get-session')

  const client = new pg.Client({ connectionString: inject('databaseUrl') })
  await client.connect()
  try {
    const { rows } = await client.query<{ key: string }>('select key from rate_limit')
    expect(rows.map(r => r.key)).toContainEqual(expect.stringContaining('/get-session'))
  }
  finally {
    await client.end()
  }
})
