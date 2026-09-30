import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { createImageStore, diskStorage, type Storage } from '../../server/image-store'
import { fakeUpstream, redirect, status, type Route } from '../source-lookup/fake-upstream'

// Seam 3: the Image Store copies a Source image into our own storage. The
// upstream is faked like Source Lookup's (no network), and the storage is a
// recorder standing in for Vercel Blob.

const JPEG = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4])

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

function storeWith(routes: Route[], options: { storage?: Storage, timeoutMs?: number, maxBytes?: number } = {}) {
  const upstream = fakeUpstream(routes)
  const storage = options.storage ?? recordingStorage()
  return { copy: createImageStore({ fetch: upstream.fetch, ...options, storage }), upstream, storage }
}

const COVER = 'https://p16-sign.tiktokcdn-eu.com/obj/cover.jpeg?x-expires=1700000000'

test('a Source image is downloaded and saved, and the stored URL comes back', async () => {
  const storage = recordingStorage()
  const { copy } = storeWith([[COVER, () => image()]], { storage })

  const stored = await copy(COVER)

  expect(storage.saved).toHaveLength(1)
  const [saved] = storage.saved
  expect(saved!.name).toMatch(/^dishes\/[0-9a-f-]{36}\.jpg$/)
  expect(saved!.contentType).toBe('image/jpeg')
  expect([...saved!.bytes]).toEqual([...JPEG])
  expect(stored).toBe(`https://store.example/${saved!.name}`)
})

test.each([
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['image/avif', 'avif'],
  ['image/jpeg; charset=binary', 'jpg'],
])('%s is kept with a .%s name', async (contentType, extension) => {
  const storage = recordingStorage()
  const { copy } = storeWith([[COVER, () => image(JPEG, contentType)]], { storage })

  expect(await copy(COVER)).not.toBeNull()
  expect(storage.saved[0]!.name.endsWith(`.${extension}`)).toBe(true)
})

test('redirects are followed to the image', async () => {
  const { copy, storage } = storeWith([
    ['https://pin.example/short', () => redirect('https://i.pinimg.com/736x/ab/cd.jpg')],
    ['https://i.pinimg.com/736x/ab/cd.jpg', () => image()],
  ])

  expect(await copy('https://pin.example/short')).not.toBeNull()
  expect((storage as ReturnType<typeof recordingStorage>).saved).toHaveLength(1)
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
  expect((storage as ReturnType<typeof recordingStorage>).saved).toEqual([])
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
  expect((storage as ReturnType<typeof recordingStorage>).saved).toEqual([])
})

test('an image over the size limit is not stored', async () => {
  const { copy, storage } = storeWith([[COVER, () => image(new Uint8Array(2048))]], { maxBytes: 1024 })

  expect(await copy(COVER)).toBeNull()
  expect((storage as ReturnType<typeof recordingStorage>).saved).toEqual([])
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
