import sharp from 'sharp'
import { expect, test } from 'vitest'
import { landingBoard, postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { storedImages } from './server-env'

// A Member's Profile Picture: their own upload (POST /api/me/pictures, then
// PUT /api/me/picture with its picture ticket), else their Google photo,
// else their initial (drawn by the client). Uploaded under the same rules as
// "Eigenes Foto"; kept apart from the Google photo, so signing in again
// leaves it be. Grete and Youyou are used by this file only.

const GRETE = ALLOWLISTED[29]
const YOUYOU = ALLOWLISTED[30]
const GRETE_GOOGLE = 'https://lh3.googleusercontent.com/a/grete'

const grete = () => signIn(GRETE, { name: 'Grete', image: GRETE_GOOGLE })
const youyou = () => signIn(YOUYOU, { name: 'Youyou' })

interface Uploaded { url: string, ticket: string }
interface Me { id: string, image: string | null, ownPicture: string | null }
interface Person { id: string, image: string | null }
interface Dish { id: string, addedBy: Person | null, cookings: { recordedBy: Person | null }[] }
interface Board { id: string, inviteToken: string, members: Person[], columns: { dishes: Dish[] }[] }

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

// Where a photo was taken, as a phone writes it into the file.
const GPS = { GPSLatitudeRef: 'N', GPSLatitude: '48/1 8/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '11/1 34/1 0/1' }
const phonePhoto = () => sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#a47' } })
  .withExif({ IFD0: { Make: 'Phone' }, IFD3: GPS })
  .jpeg()
  .toBuffer()

function upload(caller: Caller, bytes: Uint8Array, type = 'image/jpeg') {
  return caller.fetch('/api/me/pictures', { method: 'POST', headers: { 'content-type': type }, body: new Uint8Array(bytes) })
}

async function uploaded(caller: Caller): Promise<Uploaded> {
  const res = await upload(caller, await phonePhoto())
  expect(res.status).toBe(201)
  return res.json()
}

const usePicture = (caller: Caller, picture: unknown) => caller.fetch('/api/me/picture', { method: 'PUT', ...json(picture) })
const removePicture = (caller: Caller) => caller.fetch('/api/me/picture', { method: 'DELETE' })
const me = async (caller: Caller): Promise<Me> => (await caller.fetch('/api/me')).json()

const storedPictures = () => storedImages('pictures')

test('an uploaded picture is stored as a square JPEG, scaled down, without where it was taken', async () => {
  const { url, ticket } = await uploaded(await grete())

  expect(url).toMatch(/^\/images\/pictures\/[0-9a-f-]{36}\.jpg$/)
  expect(ticket).toEqual(expect.any(String))
  const stored = await anonymous().fetch(url)
  expect(stored.headers.get('content-type')).toBe('image/jpeg')
  const { format, width, height, exif, xmp } = await sharp(new Uint8Array(await stored.arrayBuffer())).metadata()
  expect({ format, width, height, exif, xmp }).toEqual({ format: 'jpeg', width: 512, height: 512, exif: undefined, xmp: undefined })
})

test('a small picture is cropped square, not enlarged', async () => {
  const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#4a7' } }).png().toBuffer()
  const res = await upload(await grete(), small, 'image/png')
  expect(res.status).toBe(201)
  const { url } = await res.json() as Uploaded

  const stored = new Uint8Array(await (await anonymous().fetch(url)).arrayBuffer())
  const { width, height } = await sharp(stored).metadata()
  expect({ width, height }).toEqual({ width: 200, height: 200 })
})

test('uploading alone changes nothing: the picture is used once it is confirmed', async () => {
  const caller = await grete()
  await removePicture(caller)
  await uploaded(caller)

  expect(await me(caller)).toMatchObject({ image: GRETE_GOOGLE, ownPicture: null })
})

test('a used picture shows instead of the Google photo, for the user and every other Member', async () => {
  const owner = await grete()
  const other = await youyou()
  const board = await landingBoard<Board>(owner)
  expect((await other.fetch(`/api/invites/${board.inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  const dish = await (await postDish(owner, board.id, { title: 'Linsencurry', placeholder: 'bowl' })).json() as Dish
  expect((await owner.fetch(`/api/dishes/${dish.id}/cook`, { method: 'POST' })).status).toBe(200)
  const { url, ticket } = await uploaded(owner)

  const res = await usePicture(owner, { url, ticket })

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ image: url, ownPicture: url })
  expect(await me(owner)).toMatchObject({ image: url, ownPicture: url })
  // What the other Member sees: the Members, who added the Dish, who cooked it.
  const seen = await (await other.fetch(`/api/boards/${board.id}`)).json() as Board
  const ownerId = (await me(owner)).id
  expect(seen.members.find(m => m.id === ownerId)).toMatchObject({ image: url })
  const seenDish = seen.columns.flatMap(c => c.dishes).find(d => d.id === dish.id)!
  expect(seenDish.addedBy).toMatchObject({ id: ownerId, image: url })
  expect(seenDish.cookings[0]!.recordedBy).toMatchObject({ id: ownerId, image: url })
  const listed = await (await other.fetch('/api/boards')).json() as { id: string, members: Person[] }[]
  expect(listed.find(b => b.id === board.id)!.members.find(m => m.id === ownerId)).toMatchObject({ image: url })
  // A Dish added now carries it straight away.
  const added = await (await postDish(owner, board.id, { title: 'Dal', placeholder: 'bowl' })).json() as Dish
  expect(added.addedBy).toMatchObject({ image: url })
})

test('signing in again keeps the own picture', async () => {
  const caller = await grete()
  const { url, ticket } = await uploaded(caller)
  expect((await usePicture(caller, { url, ticket })).status).toBe(200)

  // As Google would send it again, with a newer photo.
  const again = await signIn(GRETE, { name: 'Grete', image: 'https://lh3.googleusercontent.com/a/grete-new' })

  expect(await me(again)).toMatchObject({ image: url, ownPicture: url })
})

test('removing the own picture falls back to the Google photo', async () => {
  const caller = await grete()
  const { url, ticket } = await uploaded(caller)
  expect((await usePicture(caller, { url, ticket })).status).toBe(200)

  const res = await removePicture(caller)

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ image: GRETE_GOOGLE, ownPicture: null })
  expect(await me(caller)).toMatchObject({ image: GRETE_GOOGLE, ownPicture: null })
})

test('without a Google photo, removing it leaves no picture (the initial shows)', async () => {
  const caller = await youyou()
  const { url, ticket } = await uploaded(caller)
  expect((await usePicture(caller, { url, ticket })).status).toBe(200)

  await removePicture(caller)

  expect(await me(caller)).toMatchObject({ image: null, ownPicture: null })
})

test.each([
  ['a ticket issued to another user', async (picture: Uploaded) => ({ ...picture, ticket: (await uploaded(await youyou())).ticket })],
  ['a made-up ticket', async (picture: Uploaded) => ({ ...picture, ticket: '9999999999999.AAAA' })],
  ['a link that was never uploaded', async (picture: Uploaded) => ({ ...picture, url: 'https://evil.example/cat.jpg' })],
  ['an “Eigenes Foto” of a Dish and its photo ticket', async () => {
    const caller = await grete()
    const board = await landingBoard(caller)
    const res = await caller.fetch(`/api/boards/${board.id}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(await phonePhoto()) })
    return await res.json() as Uploaded
  }],
  ['no ticket', async (picture: Uploaded) => ({ url: picture.url })],
])('a picture with %s isn’t used (400)', async (_, forge) => {
  const caller = await grete()
  await removePicture(caller)
  const picture = await forge(await uploaded(caller))

  expect((await usePicture(caller, picture)).status).toBe(400)
  expect(await me(caller)).toMatchObject({ image: GRETE_GOOGLE, ownPicture: null })
})

test.each([
  ['a text file sent as a JPEG', () => Buffer.from('Einkaufsliste: Linsen, Reis, Koriander')],
  ['an SVG', () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
])('%s is refused as not an image (415), and nothing is stored', async (_, make) => {
  const before = await storedPictures()

  expect((await upload(await grete(), make())).status).toBe(415)
  expect(await storedPictures()).toEqual(before)
})

test('a file over 10 MB is refused as too large (413), and nothing is stored', async () => {
  const before = await storedPictures()
  const huge = Buffer.concat([await phonePhoto(), Buffer.alloc(10_000_001)])

  expect((await upload(await grete(), huge)).status).toBe(413)
  expect(await storedPictures()).toEqual(before)
})

test('only a signed-in user can upload, use or remove a picture', async () => {
  const before = await storedPictures()
  const { url, ticket } = await uploaded(await grete())
  const after = await storedPictures()

  expect((await upload(anonymous(), await phonePhoto())).status).toBe(401)
  expect((await usePicture(anonymous(), { url, ticket })).status).toBe(401)
  expect((await removePicture(anonymous())).status).toBe(401)
  expect(await storedPictures()).toHaveLength(before.length + 1)
  expect(await storedPictures()).toEqual(after)
})
