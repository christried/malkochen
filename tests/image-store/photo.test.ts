import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { expect, test } from 'vitest'
import { createPhotoStore, PHOTO_MAX_SIDE, PICTURE_SIDE, preparePhoto } from '../../server/image-store/photo'
import type { Storage } from '../../server/image-store'

// Seam 3: a Member's own photo ("Eigenes Foto") before it goes into the
// Image Store. Told apart by its content, never its name; scaled down and
// stripped of its metadata (above all, where it was taken). The photos are
// made with sharp here; the HEIC one is a fixture (see fixtures/README.md).

// Where a photo was taken, as a phone writes it into the file.
const GPS = { GPSLatitudeRef: 'N', GPSLatitude: '48/1 8/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '11/1 34/1 0/1' }

function photo(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#c84' } })
}

const phoneJpeg = () => photo(3000, 2000).withExif({ IFD0: { Make: 'Phone' }, IFD3: GPS }).jpeg().toBuffer()

async function metadataOf(bytes: Uint8Array) {
  return sharp(bytes).metadata()
}

test('a phone’s JPEG comes back as a JPEG no larger than the maximum, without its metadata', async () => {
  const original = await phoneJpeg()
  expect((await metadataOf(original)).exif).toBeDefined()

  const prepared = await preparePhoto(original)

  if (!prepared.ok) throw new Error(`refused: ${prepared.refusal}`)
  expect(prepared.contentType).toBe('image/jpeg')
  const { format, width, height, exif, icc, xmp } = await metadataOf(prepared.bytes)
  expect(format).toBe('jpeg')
  expect([width, height]).toEqual([PHOTO_MAX_SIDE, Math.round(PHOTO_MAX_SIDE * 2 / 3)])
  expect({ exif, icc, xmp }).toEqual({ exif: undefined, icc: undefined, xmp: undefined })
})

test('a photo taken upright stays upright: its orientation is applied, not dropped', async () => {
  // Stored landscape, marked "rotate 90°" (EXIF orientation 6).
  const sideways = await photo(400, 300).withMetadata({ orientation: 6 }).jpeg().toBuffer()

  const prepared = await preparePhoto(sideways)

  if (!prepared.ok) throw new Error(`refused: ${prepared.refusal}`)
  const { width, height, orientation } = await metadataOf(prepared.bytes)
  expect([width, height, orientation]).toEqual([300, 400, undefined])
})

test('a small photo isn’t enlarged', async () => {
  const prepared = await preparePhoto(await photo(640, 480).png().toBuffer())

  if (!prepared.ok) throw new Error(`refused: ${prepared.refusal}`)
  const { format, width, height } = await metadataOf(prepared.bytes)
  expect([format, width, height]).toEqual(['jpeg', 640, 480])
})

test.each([
  ['PNG', () => photo(800, 600).png().toBuffer()],
  ['WebP', () => photo(800, 600).webp().toBuffer()],
  ['PNG with transparency', () => sharp({ create: { width: 80, height: 60, channels: 4, background: '#c840' } }).png().toBuffer()],
  ['HEIC', () => readFile(join(import.meta.dirname, 'fixtures/tiny.heic'))],
])('a %s becomes a JPEG', async (_, make) => {
  const prepared = await preparePhoto(await make())

  if (!prepared.ok) throw new Error(`refused: ${prepared.refusal}`)
  expect((await metadataOf(prepared.bytes)).format).toBe('jpeg')
})

test.each([
  ['a text file named .jpg', () => Buffer.from('Einkaufsliste: Linsen, Reis, Koriander')],
  ['an empty file', () => Buffer.alloc(0)],
  ['a JPEG that breaks off in its header', async () => (await phoneJpeg()).subarray(0, 200)],
  ['an SVG', () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
  ['a GIF', () => photo(20, 20).gif().toBuffer()],
  // Found images may be GIF or AVIF (image-store.test.ts); a phone's photo isn't.
  ['an AVIF', () => photo(20, 20).avif().toBuffer()],
  ['a PDF', () => Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')],
])('%s is refused as not an image', async (_, make) => {
  expect(await preparePhoto(await make())).toEqual({ ok: false, refusal: 'not-an-image' })
})

test('a file over the size limit is refused as too large, whatever it is', async () => {
  const original = await phoneJpeg()

  expect(await preparePhoto(original, { maxBytes: original.length - 1 })).toEqual({ ok: false, refusal: 'too-large' })
})

// A small file can unpack to an enormous image (a "decompression bomb").
test.each([
  ['PNG', () => photo(200, 100).png().toBuffer()],
  ['HEIC', () => readFile(join(import.meta.dirname, 'fixtures/tiny.heic'))],
])('a %s with more pixels than allowed is refused as not an image', async (_, make) => {
  expect(await preparePhoto(await make(), { maxPixels: 1000 })).toEqual({ ok: false, refusal: 'not-an-image' })
})

// A Profile Picture shows round: cut to a square around its middle, at
// most PICTURE_SIDE across.
test('as a Profile Picture, a photo is cut to a square around its middle and scaled down', async () => {
  // Left half red, right half blue: the middle square holds both.
  const halves = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#f00' } })
    .composite([{ input: { create: { width: 1500, height: 1000, channels: 3, background: '#00f' } }, left: 1500, top: 0 }])
    .jpeg()
    .toBuffer()

  const prepared = await preparePhoto(halves, { square: PICTURE_SIDE })

  if (!prepared.ok) throw new Error(`refused: ${prepared.refusal}`)
  const { format, width, height, exif } = await metadataOf(prepared.bytes)
  expect({ format, width, height, exif }).toEqual({ format: 'jpeg', width: PICTURE_SIDE, height: PICTURE_SIDE, exif: undefined })
  const { data } = await sharp(prepared.bytes).raw().toBuffer({ resolveWithObject: true })
  const pixel = (x: number) => [...data.subarray((10 * PICTURE_SIDE + x) * 3, (10 * PICTURE_SIDE + x) * 3 + 3)]
  expect(pixel(5)[0]).toBeGreaterThan(200)
  expect(pixel(PICTURE_SIDE - 5)[2]).toBeGreaterThan(200)
})

test('as a Profile Picture, a small photo is cut square but not enlarged', async () => {
  const prepared = await preparePhoto(await photo(300, 200).png().toBuffer(), { square: PICTURE_SIDE })

  if (!prepared.ok) throw new Error(`refused: ${prepared.refusal}`)
  const { width, height } = await metadataOf(prepared.bytes)
  expect([width, height]).toEqual([200, 200])
})

test('as a Profile Picture, a photo taken upright is cut square upright', async () => {
  // Stored landscape, marked "rotate 90°" (EXIF orientation 6).
  const sideways = await photo(400, 300).withMetadata({ orientation: 6 }).jpeg().toBuffer()

  const prepared = await preparePhoto(sideways, { square: PICTURE_SIDE })

  if (!prepared.ok) throw new Error(`refused: ${prepared.refusal}`)
  const { width, height, orientation } = await metadataOf(prepared.bytes)
  expect([width, height, orientation]).toEqual([300, 300, undefined])
})

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

test('a stored photo is saved as a Dish image and its URL comes back', async () => {
  const storage = recordingStorage()
  const store = createPhotoStore({ storage })

  const stored = await store(await phoneJpeg())

  expect(storage.saved).toHaveLength(1)
  const [saved] = storage.saved
  expect(saved!.name).toMatch(/^dishes\/[0-9a-f-]{36}\.jpg$/)
  expect(saved!.contentType).toBe('image/jpeg')
  expect((await metadataOf(saved!.bytes)).exif).toBeUndefined()
  expect(stored).toEqual({ ok: true, url: `https://store.example/${saved!.name}` })
})

test('a store for Profile Pictures saves square pictures under pictures/', async () => {
  const storage = recordingStorage()
  const store = createPhotoStore({ storage, folder: 'pictures', square: PICTURE_SIDE })

  const stored = await store(await phoneJpeg())

  const [saved] = storage.saved
  expect(saved!.name).toMatch(/^pictures\/[0-9a-f-]{36}\.jpg$/)
  const { width, height } = await metadataOf(saved!.bytes)
  expect([width, height]).toEqual([PICTURE_SIDE, PICTURE_SIDE])
  expect(stored).toEqual({ ok: true, url: `https://store.example/${saved!.name}` })
})

test('a refused photo is never stored', async () => {
  const storage = recordingStorage()
  const store = createPhotoStore({ storage })

  expect(await store(Buffer.from('not a photo'))).toEqual({ ok: false, refusal: 'not-an-image' })
  expect(storage.saved).toEqual([])
})

test('when storage fails, the photo isn’t stored and the reason is told', async () => {
  const reasons: string[] = []
  const store = createPhotoStore({ storage: recordingStorage(true), onFailure: reason => reasons.push(reason) })

  expect(await store(await phoneJpeg())).toEqual({ ok: false, refusal: 'not-stored' })
  expect(reasons).toEqual(['storage failed: storage is down'])
})
