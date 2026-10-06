import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { createImageTickets } from '../../server/image-store/tickets'
import { testAuthEnv } from '../support/test-auth-env'
import { landingBoard, postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'

// Without a Vercel Blob token (as here) stored images are served from disk.
// Only names the Image Store writes are ever read.
test.each([
  ['a missing image', '/images/dishes/00000000-0000-4000-8000-000000000000.jpg'],
  ['a name the Image Store never writes', '/images/dishes/cover.jpg'],
  ['a path outside the image folder', '/images/..%2F..%2Fpackage.json'],
  ['an SVG', '/images/dishes/00000000-0000-4000-8000-000000000000.svg'],
])('%s is not found', async (_, path) => {
  expect((await anonymous().fetch(path)).status).toBe(404)
})

// Tickets as GET /api/source-lookup issues them (same secret as the server).
const tickets = createImageTickets(testAuthEnv('').BETTER_AUTH_SECRET!)
const me = async (caller: Caller) => ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
// Where the test server's disk storage keeps copies (server/utils/image-store.ts).
const storedImages = () => readdir(resolve('.data/images/dishes')).catch(() => [])

// The order (membership before the copy) is covered with a recording Image
// Store in tests/image-store/found-image.test.ts; here no copy can succeed
// anyway, so this pins what a non-Member gets back over HTTP.
test('a non-Member’s write copies no image, adding a Dish or reloading its image', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const dish = await (await postDish(ada, board.id, { title: 'Dal', placeholder: 'bowl' })).json() as { id: string }
  const linus = await signIn(ALLOWLISTED[2])
  const imageUrl = 'https://cdn.example/cover.jpg'
  const imageTicket = tickets.issue(await me(linus), imageUrl)
  const before = await storedImages()

  expect((await postDish(linus, board.id, { title: 'Eindringling', placeholder: 'bowl', imageUrl, imageTicket })).status).toBe(404)
  const edit = await linus.fetch(`/api/dishes/${dish.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageUrl, imageTicket }),
  })
  expect(edit.status).toBe(404)
  expect(await storedImages()).toEqual(before)
})
