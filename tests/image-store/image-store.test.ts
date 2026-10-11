import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, test } from 'vitest'
import { createImageStore, diskStorage, type Storage } from '../../server/image-store'
import { PHOTO_MAX_SIDE } from '../../server/image-store/photo'
import { fakeUpstream, redirect, status, type Route } from '../source-lookup/fake-upstream'

// Seam 3: the Image Store copies a Source image into our own storage. The
// upstream is faked like Source Lookup's (no network), and the storage is a
// recorder standing in for Vercel Blob. The images are made with sharp.

const picture = (width = 40, height = 30, background = '#c84') => sharp({ create: { width, height, channels: 3, background } })
const bytesOf = async (made: Promise<Buffer>) => new Uint8Array(await made)

const JPEG = await bytesOf(picture().jpeg().toBuffer())

function image(bytes: Uint8Array<ArrayBuffer> = JPEG, contentType = 'image/jpeg', code = 200): Response {
  return new Response(bytes, { status: code, headers: { 'content-type': contentType } })
}

interface Saved { name: string, bytes: Uint8Array, contentType: string }

function recordingStorage(fail = false): Storage & { saved: Saved[] } {
  const saved: Saved[] = []
  return {
    saved,
    async save(name, bytes, contentType) {
      if (fail) throw new Error('storage is down')
      saved.push({ name, bytes, contentType })
      return `https://store.example/${name}`
    },
  }
}

function storeWith(routes: Route[], options: { storage?: ReturnType<typeof recordingStorage>, timeoutMs?: number, maxBytes?: number, maxPixels?: number } = {}) {
  const upstream = fakeUpstream(routes)
  const storage = options.storage ?? recordingStorage()
  return { copy: createImageStore({ fetch: upstream.fetch, ...options, storage }), upstream, storage }
}

const COVER = 'https://p16-sign.tiktokcdn-eu.com/obj/cover.jpeg?x-expires=1700000000'

// Prepared like an Own Photo (server/image-store/photo.ts): scaled down to
// fit PHOTO_MAX_SIDE and re-encoded without its metadata.
test('a Source image is downloaded, prepared and saved as a JPEG, and the stored URL comes back', async () => {
  const camera = { IFD0: { Make: 'Camera' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '48/1 8/1 0/1' } }
  const large = await bytesOf(picture(3000, 2000).withExif(camera).jpeg().toBuffer())
  expect((await sharp(large).metadata()).exif).toBeDefined()
  const storage = recordingStorage()
  const { copy } = storeWith([[COVER, () => image(large)]], { storage })

  const stored = await copy(COVER)

  expect(storage.saved).toHaveLength(1)
  const [saved] = storage.saved
  expect(saved!.name).toMatch(/^dishes\/[0-9a-f-]{36}\.jpg$/)
  expect(saved!.contentType).toBe('image/jpeg')
  const { format, width, height, exif } = await sharp(saved!.bytes).metadata()
  expect({ format, width, height, exif }).toEqual({ format: 'jpeg', width: PHOTO_MAX_SIDE, height: Math.round(PHOTO_MAX_SIDE * 2 / 3), exif: undefined })
  expect(stored).toBe(`https://store.example/${saved!.name}`)
})

test.each([
  ['image/png', picture().png().toBuffer()],
  ['image/webp', picture().webp().toBuffer()],
  ['image/gif', picture().gif().toBuffer()],
  ['image/avif', picture().avif().toBuffer()],
  ['image/jpeg; charset=binary', picture().jpeg().toBuffer()],
])('%s is stored as a JPEG', async (contentType, made) => {
  const bytes = await bytesOf(made)
  const storage = recordingStorage()
  const { copy } = storeWith([[COVER, () => image(bytes, contentType)]], { storage })

  expect(await copy(COVER)).not.toBeNull()
  const [saved] = storage.saved
  expect(saved!.name.endsWith('.jpg')).toBe(true)
  expect(saved!.contentType).toBe('image/jpeg')
  expect((await sharp(saved!.bytes).metadata()).format).toBe('jpeg')
})

test('an animated GIF is stored as a still', async () => {
  const frames = await Promise.all([picture(40, 30, '#c84').png().toBuffer(), picture(40, 30, '#48c').png().toBuffer()])
  const animated = await bytesOf(sharp(frames, { join: { animated: true } }).gif().toBuffer())
  expect((await sharp(animated).metadata()).pages).toBe(2)
  const storage = recordingStorage()
  const { copy } = storeWith([[COVER, () => image(animated, 'image/gif')]], { storage })

  expect(await copy(COVER)).not.toBeNull()
  const { format, pages } = await sharp(storage.saved[0]!.bytes).metadata()
  expect({ format, pages }).toEqual({ format: 'jpeg', pages: undefined })
})

// What the server claims the type is counts for nothing: the bytes must be
// a raster image.
test.each([
  ['an SVG claiming to be a PNG', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/png'],
  ['an HTML page claiming to be a JPEG', '<!doctype html><title>Linsen</title>', 'image/jpeg'],
  ['text claiming to be a WebP', 'Linsen, Reis, Koriander', 'image/webp'],
])('%s is not stored', async (_, body, contentType) => {
  const { copy, storage } = storeWith([[COVER, () => image(new TextEncoder().encode(body), contentType)]])

  expect(await copy(COVER)).toBeNull()
  expect(storage.saved).toEqual([])
})

test('a JPEG that breaks off in its header is not stored', async () => {
  const { copy, storage } = storeWith([[COVER, () => image(JPEG.slice(0, 100))]])

  expect(await copy(COVER)).toBeNull()
  expect(storage.saved).toEqual([])
})

// A small file can unpack to an enormous image (a "decompression bomb").
test('an image with more pixels than allowed is not stored', async () => {
  const { copy, storage } = storeWith([[COVER, () => image()]], { maxPixels: 40 * 30 - 1 })

  expect(await copy(COVER)).toBeNull()
  expect(storage.saved).toEqual([])
})

test('redirects are followed to the image', async () => {
  const { copy, storage } = storeWith([
    ['https://pin.example/short', () => redirect('https://i.pinimg.com/736x/ab/cd.jpg')],
    ['https://i.pinimg.com/736x/ab/cd.jpg', () => image()],
  ])

  expect(await copy('https://pin.example/short')).not.toBeNull()
  expect(storage.saved).toHaveLength(1)
})

test.each([
  ['a loopback address', 'http://127.0.0.1/cover.jpg'],
  ['a private network address', 'http://192.168.1.10/cover.jpg'],
  ['localhost', 'http://localhost:3000/cover.jpg'],
  ['not a web link', 'file:///etc/passwd'],
])('%s is never fetched', async (_, link) => {
  const { copy, upstream, storage } = storeWith([[link, () => image()]])

  expect(await copy(link)).toBeNull()
  expect(upstream.requested).toEqual([])
  expect(storage.saved).toEqual([])
})

test('a redirect to a private address is not followed', async () => {
  const { copy, upstream } = storeWith([
    ['https://cdn.example/cover.jpg', () => redirect('http://169.254.169.254/latest/meta-data')],
    ['http://169.254.169.254/', () => image()],
  ])

  expect(await copy('https://cdn.example/cover.jpg')).toBeNull()
  expect(upstream.requested).toEqual(['https://cdn.example/cover.jpg'])
})

test.each([
  ['an HTML page', () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } })],
  // Served from our own origin, an SVG could run script.
  ['an SVG', () => image(new TextEncoder().encode('<svg/>'), 'image/svg+xml')],
  ['no content type', () => new Response(JPEG)],
  ['an error status', () => image(JPEG, 'image/jpeg', 404)],
  ['a failing upstream', () => status(503)],
  ['an empty body', () => image(new Uint8Array(), 'image/jpeg')],
])('%s is not stored', async (_, reply) => {
  const { copy, storage } = storeWith([[COVER, reply]])

  expect(await copy(COVER)).toBeNull()
  expect(storage.saved).toEqual([])
})

test('an image over the size limit is not stored', async () => {
  const { copy, storage } = storeWith([[COVER, () => image(new Uint8Array(2048))]], { maxBytes: 1024 })

  expect(await copy(COVER)).toBeNull()
  expect(storage.saved).toEqual([])
})

test('an upstream that never answers gives up after the time budget', async () => {
  const { copy } = storeWith([[COVER, () => 'hang']], { timeoutMs: 50 })

  expect(await copy(COVER)).toBeNull()
})

test('a failing storage gives no stored image instead of an error', async () => {
  const { copy } = storeWith([[COVER, () => image()]], { storage: recordingStorage(true) })

  expect(await copy(COVER)).toBeNull()
})

// Local dev and the test servers store on disk instead of Vercel Blob.
let dir: string | undefined
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = undefined
})

test('disk storage writes the file and serves it under /images/', async () => {
  dir = await mkdtemp(join(tmpdir(), 'malkochen-images-'))

  const url = await diskStorage(dir).save('dishes/abc.jpg', JPEG, 'image/jpeg')

  expect(url).toBe('/images/dishes/abc.jpg')
  expect([...await readFile(join(dir, 'dishes', 'abc.jpg'))]).toEqual([...JPEG])
})

test('each failure is reported with its reason, so production logs show why', async () => {
  const failures: string[] = []
  const onFailure = (imageUrl: string, reason: string) => { failures.push(`${imageUrl}: ${reason}`) }
  const upstream = fakeUpstream([
    [COVER, () => image()],
    ['https://cdn.example/page', () => new Response('<html>', { headers: { 'content-type': 'text/html' } })],
    ['https://cdn.example/fake.png', () => image(new TextEncoder().encode('<svg/>'), 'image/png')],
  ])

  await createImageStore({ fetch: upstream.fetch, storage: recordingStorage(), onFailure })('https://cdn.example/page')
  await createImageStore({ fetch: upstream.fetch, storage: recordingStorage(), onFailure })('https://cdn.example/fake.png')
  await createImageStore({ fetch: upstream.fetch, storage: recordingStorage(true), onFailure })(COVER)

  expect(failures).toEqual([
    'https://cdn.example/page: download failed (unreachable, not an image, empty or too large)',
    'https://cdn.example/fake.png: not stored: not-an-image',
    `${COVER}: storage failed: storage is down`,
  ])
})
