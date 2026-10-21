import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { beforeEach, expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { storedImages } from './server-env'
import { endLimitWindows } from './time-travel'

// "Eigenes Foto": a Member uploads their own photo to a Board they are on
// (POST /api/boards/:id/photos) and gets back where it is stored, with a
// photo ticket. Adding or editing a Dish with that photo makes it the Dish's
// image. Told apart by content, scaled down, stripped of its metadata.

// More photos than one user may upload a day (server/rate-limits.ts): each
// test starts as if the day were over.
beforeEach(() => endLimitWindows('upload'))

interface Dish { id: string, imageUrl: string | null, placeholder: string }
interface Board { id: string, columns: { dishes: Dish[] }[] }
interface Uploaded { url: string, ticket: string }

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

// Where a photo was taken, as a phone writes it into the file.
const GPS = { GPSLatitudeRef: 'N', GPSLatitude: '48/1 8/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '11/1 34/1 0/1' }
const phonePhoto = () => sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#7a4' } })
  .withExif({ IFD0: { Make: 'Phone' }, IFD3: GPS })
  .jpeg()
  .toBuffer()

function upload(caller: Caller, boardId: string, bytes: Uint8Array, type = 'image/jpeg') {
  return caller.fetch(`/api/boards/${boardId}/photos`, { method: 'POST', headers: { 'content-type': type }, body: new Uint8Array(bytes) })
}

async function uploaded(caller: Caller, boardId: string): Promise<Uploaded> {
  const res = await upload(caller, boardId, await phonePhoto())
  expect(res.status).toBe(201)
  return res.json()
}

function editDish(caller: Caller, dishId: string, body: unknown) {
  return caller.fetch(`/api/dishes/${dishId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const onBoard = async (caller: Caller, dishId: string) =>
  (await landingBoard(caller)).columns.flatMap(c => c.dishes).find(d => d.id === dishId)


test('an uploaded photo is stored as a JPEG, scaled down, without where it was taken', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  const { url, ticket } = await uploaded(ada, board.id)

  expect(url).toMatch(/^\/images\/dishes\/[0-9a-f-]{36}\.jpg$/)
  expect(ticket).toEqual(expect.any(String))
  const stored = await ada.fetch(url)
  expect(stored.headers.get('content-type')).toBe('image/jpeg')
  const { format, width, height, exif, xmp } = await sharp(new Uint8Array(await stored.arrayBuffer())).metadata()
  expect({ format, width, height, exif, xmp }).toEqual({ format: 'jpeg', width: 1600, height: 1200, exif: undefined, xmp: undefined })
})

// As some phones save them; sharp can't read it, so the server bundles libheif.
test('a HEIC photo is stored as a JPEG too', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const heic = await readFile(join(import.meta.dirname, '../image-store/fixtures/tiny.heic'))

  const res = await upload(ada, board.id, heic, 'image/heic')

  expect(res.status).toBe(201)
  const { url } = await res.json() as Uploaded
  const stored = new Uint8Array(await (await ada.fetch(url)).arrayBuffer())
  expect((await sharp(stored).metadata()).format).toBe('jpeg')
})

test('a Dish added with an uploaded photo shows it', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const photo = await uploaded(ada, board.id)

  const res = await postDish(ada, board.id, { title: 'Ofengemüse', placeholder: 'bowl', photo })

  expect(res.status).toBe(201)
  const added = await res.json() as Dish & { imageNotStored?: boolean }
  expect(added).toMatchObject({ imageUrl: photo.url, placeholder: 'bowl' })
  expect(added.imageNotStored).toBeUndefined()
  expect(await onBoard(ada, added.id)).toMatchObject({ imageUrl: photo.url })
})

test('a Member can replace a Dish’s image with their photo, and the photo with a Placeholder again', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const dish = await (await postDish(ada, board.id, { title: 'Shakshuka', placeholder: 'bowl' })).json() as Dish
  const photo = await uploaded(ada, board.id)

  const res = await editDish(ada, dish.id, { photo })

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ imageUrl: photo.url, placeholder: 'bowl' })
  expect(await onBoard(ada, dish.id)).toMatchObject({ imageUrl: photo.url })

  expect((await editDish(ada, dish.id, { imageUrl: null, placeholder: 'ramen' })).status).toBe(200)
  expect(await onBoard(ada, dish.id)).toMatchObject({ imageUrl: null, placeholder: 'ramen' })
})

test.each([
  ['a ticket issued to another Member', async (photo: Uploaded) => ({ ...photo, ticket: (await uploaded(await signIn(ALLOWLISTED[1]), (await landingBoard(await signIn(ALLOWLISTED[1]))).id)).ticket })],
  ['a made-up ticket', async (photo: Uploaded) => ({ ...photo, ticket: '9999999999999.AAAA' })],
  ['a link that was never uploaded', async (photo: Uploaded) => ({ ...photo, url: 'https://evil.example/cat.jpg' })],
])('a photo with %s isn’t used: the Dish keeps its image and the Member is told', async (_, forge) => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const photo = await forge(await uploaded(ada, board.id))

  const added = await (await postDish(ada, board.id, { title: 'Falafel', placeholder: 'bowl', photo })).json() as Dish & { imageNotStored?: boolean }
  expect(added).toMatchObject({ imageUrl: null, imageNotStored: true })

  const edited = await (await editDish(ada, added.id, { photo })).json() as Dish & { imageNotStored?: boolean }
  expect(edited).toMatchObject({ imageUrl: null, imageNotStored: true })
})

test.each([
  ['a text file sent as a JPEG', () => Buffer.from('Einkaufsliste: Linsen, Reis, Koriander')],
  ['an SVG', () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
  ['nothing', () => Buffer.alloc(0)],
])('%s is refused as not an image (415), and nothing is stored', async (_, make) => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const before = await storedImages()

  expect((await upload(ada, board.id, make())).status).toBe(415)
  expect(await storedImages()).toEqual(before)
})

test('a file over 10 MB is refused as too large (413), and nothing is stored', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const before = await storedImages()
  const huge = Buffer.concat([await phonePhoto(), Buffer.alloc(10_000_001)])

  expect((await upload(ada, board.id, huge)).status).toBe(413)
  expect(await storedImages()).toEqual(before)
})

test('a body of unannounced size (chunked) isn’t read at all (411)', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const photo = await phonePhoto()
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array(photo))
    controller.close()
  } })

  const res = await ada.fetch(`/api/boards/${board.id}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body, duplex: 'half' } as RequestInit)

  expect(res.status).toBe(411)
})

test('only a Member can upload to a Board, and only when signed in', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const before = await storedImages()

  expect((await upload(await signIn(ALLOWLISTED[2]), board.id, await phonePhoto())).status).toBe(404)
  expect((await upload(anonymous(), board.id, await phonePhoto())).status).toBe(401)
  expect(await storedImages()).toEqual(before)
})
