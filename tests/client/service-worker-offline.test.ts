import { readdirSync, readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from 'vitest'

// The service worker's part in opening malkochen offline (#461, public/sw.js):
// navigations network first, then the app shell for an app address, then the
// Offline page; built files and images kept as they are fetched; the API
// never. Run here with the browser's service worker scope, its caches and
// its network faked.

const ORIGIN = 'https://malkochen.example'
const BLOB = 'https://abc123.public.blob.vercel-storage.com'
const SOURCE = readFileSync('public/sw.js', 'utf8')

type Respond = (url: string, request: FakeRequest, init?: RequestInit) => Response | Promise<Response>

interface FakeRequest {
  method: string
  url: string
  mode?: string
  destination?: string
}

// The caches: by name, each a list of URL and response in the order put.
function fakeCaches() {
  const named = new Map<string, Map<string, Response>>()
  const key = (request: FakeRequest | string) => new URL(typeof request === 'string' ? request : request.url, ORIGIN).href
  const cacheOf = (name: string) => {
    if (!named.has(name)) named.set(name, new Map())
    const entries = named.get(name)!
    return {
      put: async (request: FakeRequest | string, response: Response) => {
        entries.delete(key(request))
        entries.set(key(request), response)
      },
      match: async (request: FakeRequest | string) => entries.get(key(request))?.clone(),
      add: async (path: string) => {
        const response = await network.fetch(new URL(path, ORIGIN).href)
        if (!response.ok) throw new Error(`bad response for ${path}`)
        entries.set(key(path), response)
      },
      addAll: async (paths: string[]) => {
        for (const path of paths) await cacheOf(name).add(path)
      },
      keys: async () => [...entries.keys()].map(url => ({ url })),
      delete: async (request: { url: string } | string) => entries.delete(key(request as FakeRequest | string)),
    }
  }
  // Set below, once the network exists.
  const network = { fetch: (_url: string): Promise<Response> => Promise.reject(new Error('no network')) }
  return {
    named,
    network,
    api: {
      open: async (name: string) => cacheOf(name),
      has: async (name: string) => named.has(name),
      keys: async () => [...named.keys()],
      delete: async (name: string) => named.delete(name),
      match: async (request: FakeRequest | string) => {
        for (const entries of named.values()) {
          const hit = entries.get(key(request))
          if (hit) return hit.clone()
        }
        return undefined
      },
    },
    urls: (name: string) => [...(named.get(name)?.keys() ?? [])].map(url => url.replace(ORIGIN, '')),
  }
}

function serviceWorker(respond: Respond = () => new Response('ok')) {
  const listeners = new Map<string, (event: unknown) => void>()
  const store = fakeCaches()
  // The network: answers, or is down.
  let down = false
  const fetched: { url: string, init?: RequestInit }[] = []
  const fakeFetch = async (input: FakeRequest | string, init?: RequestInit): Promise<Response> => {
    const request = typeof input === 'string' ? { method: 'GET', url: input } : input
    fetched.push({ url: request.url, init })
    if (down) throw new TypeError('Failed to fetch')
    return respond(request.url, request, init)
  }
  store.network.fetch = fakeFetch
  const claimed = { value: false }
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    skipWaiting: async () => {},
    clients: { claim: async () => { claimed.value = true } },
  }
  runInNewContext(SOURCE, { self, caches: store.api, fetch: fakeFetch, URL, Response, Promise, console })

  async function dispatch(type: string, event: Record<string, unknown>) {
    const waits: Promise<unknown>[] = []
    listeners.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
  }

  // A request through the worker: what it answered, or null if it left the
  // request to the browser.
  async function request(url: string, extra: Partial<FakeRequest> = {}): Promise<Response | null> {
    let answered: Promise<Response> | null = null
    const waits: Promise<unknown>[] = []
    listeners.get('fetch')!({
      request: { method: 'GET', url: new URL(url, ORIGIN).href, ...extra },
      respondWith: (p: Promise<Response>) => {
        answered = p
      },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    })
    const response = answered ? await answered : null
    await Promise.all(waits)
    return response
  }
  const navigate = (url: string) => request(url, { mode: 'navigate' })

  return {
    store,
    fetched,
    claimed,
    install: () => dispatch('install', {}),
    activate: () => dispatch('activate', {}),
    message: (data: unknown) => dispatch('message', { data }),
    request,
    navigate,
    goOffline: () => {
      down = true
    },
    goOnline: () => {
      down = false
    },
  }
}

// The files malkochen answers with.
function site(files: Record<string, string | Response> = {}): Respond {
  return (url) => {
    const path = url.replace(ORIGIN, '')
    const body = files[path] ?? files['*'] ?? 'page'
    if (body instanceof Response) return body.clone()
    return new Response(body, { status: path.startsWith('/missing') ? 404 : 200 })
  }
}

const text = async (response: Response | null) => response ? await response.text() : null

async function installed(files: Record<string, string | Response> = { '/offline.html': 'OFFLINE', '/app-shell': 'SHELL' }) {
  const sw = serviceWorker(site(files))
  await sw.install()
  await sw.activate()
  return sw
}

test('installing keeps the Offline page, the app shell and the Placeholder Images', async () => {
  const sw = await installed()

  const kept = sw.store.urls('offline-v14')
  expect(kept).toEqual(expect.arrayContaining(['/offline.html', '/app-shell', '/clips/offline-light.svg', '/placeholders/pasta-light.svg', '/placeholders/eintopf-dark.svg']))
})

test('the Placeholder Images it keeps are those in public/placeholders', async () => {
  const sw = await installed()

  const kept = sw.store.urls('offline-v14').filter(url => url.startsWith('/placeholders/')).map(url => url.replace('/placeholders/', '')).sort()
  expect(kept).toEqual(readdirSync('public/placeholders').sort())
})

test('an app shell that can\'t be had does not fail the install', async () => {
  const sw = serviceWorker(site({ '/app-shell': new Response('nope', { status: 500 }) }))

  await sw.install()

  expect(sw.store.urls('offline-v14')).toContain('/offline.html')
  expect(sw.store.urls('offline-v14')).not.toContain('/app-shell')
})

test('activating deletes the caches of older versions, and keeps the current ones', async () => {
  const sw = await installed()
  const keep = await sw.store.api.open('images-v1')
  await keep.put('/images/a.jpg', new Response('a'))
  await (await sw.store.api.open('offline-v13')).put('/offline.html', new Response('old'))
  await (await sw.store.api.open('something-else')).put('/x', new Response('x'))

  await sw.activate()

  expect(await sw.store.api.keys()).toEqual(expect.arrayContaining(['offline-v14', 'images-v1']))
  expect(await sw.store.api.keys()).not.toContain('offline-v13')
  expect(await sw.store.api.keys()).not.toContain('something-else')
  expect(sw.claimed.value).toBe(true)
})

test('a page is fetched from the network first', async () => {
  const sw = await installed({ '/offline.html': 'OFFLINE', '/app-shell': 'SHELL', '/b/kochclub': 'FRESH' })

  expect(await text(await sw.navigate('/b/kochclub'))).toBe('FRESH')
})

test('an app address without a connection opens the app shell', async () => {
  const sw = await installed()
  sw.goOffline()

  for (const path of ['/', '/b/kochclub', '/b/kochclub/linsensuppe-3f9k', '/b/9f1c/d/3b2a', '/share?url=x']) {
    expect(await text(await sw.navigate(path))).toBe('SHELL')
  }
})

test('any other address without a connection gets the Offline page, and so does the Board\'s settings', async () => {
  const sw = await installed()
  sw.goOffline()

  for (const path of ['/changelog', '/settings', '/b/kochclub/settings', '/invite/abc', '/login']) {
    expect(await text(await sw.navigate(path))).toBe('OFFLINE')
  }
})

test('an app address while the shell isn\'t kept gets the Offline page', async () => {
  const sw = await installed({ '/offline.html': 'OFFLINE', '/app-shell': new Response('nope', { status: 404 }) })
  sw.goOffline()

  expect(await text(await sw.navigate('/b/kochclub'))).toBe('OFFLINE')
})

test('a Vercel platform error counts as no answer, a malkochen error screen does not', async () => {
  const platform = new Response('An error occurred', { status: 502, headers: { 'x-vercel-error': 'NO_RESPONSE_FROM_FUNCTION' } })
  const ours = new Response('Da ist was angebrannt', { status: 500 })
  const sw = await installed({ '/offline.html': 'OFFLINE', '/app-shell': 'SHELL', '/b/down': platform, '/changelog': platform, '/b/ours': ours })

  expect(await text(await sw.navigate('/b/down'))).toBe('SHELL')
  expect(await text(await sw.navigate('/changelog'))).toBe('OFFLINE')
  expect(await text(await sw.navigate('/b/ours'))).toBe('Da ist was angebrannt')
})

test('a page that loads keeps the app shell fresh', async () => {
  const sw = await installed()
  sw.fetched.length = 0

  await sw.navigate('/b/kochclub')

  expect(sw.fetched.map(f => f.url.replace(ORIGIN, ''))).toEqual(['/b/kochclub', '/app-shell'])
})

test('the API is left alone: no request to it is answered by the worker', async () => {
  const sw = await installed()

  expect(await sw.request('/api/boards/1')).toBeNull()
  expect(await sw.request('/api/boards/1/seen', { method: 'POST' })).toBeNull()
  expect(sw.store.urls('assets-v1').concat(sw.store.urls('images-v1'))).toEqual([])
})

test('a built file with a hash in its name is kept when fetched and then served from the cache, not the network', async () => {
  const sw = await installed({ '/offline.html': 'OFFLINE', '/app-shell': 'SHELL', '/_nuxt/D5mTgIqb.js': 'v1' })
  expect(await text(await sw.request('/_nuxt/D5mTgIqb.js', { destination: 'script' }))).toBe('v1')
  sw.fetched.length = 0

  sw.goOffline()
  expect(await text(await sw.request('/_nuxt/D5mTgIqb.js', { destination: 'script' }))).toBe('v1')
  sw.goOnline()
  expect(await text(await sw.request('/_nuxt/D5mTgIqb.js', { destination: 'script' }))).toBe('v1')
  expect(sw.fetched).toEqual([])
})

test('a built file without a hash comes from the network first and from the cache only without one', async () => {
  let version = 'v1'
  const sw = serviceWorker(url => new Response(url.endsWith('/_nuxt/app/entry.js') ? version : 'x'))
  await sw.install()
  await sw.request('/_nuxt/app/entry.js')
  version = 'v2'

  expect(await text(await sw.request('/_nuxt/app/entry.js'))).toBe('v2')
  sw.goOffline()
  expect(await text(await sw.request('/_nuxt/app/entry.js'))).toBe('v2')
})

test('a built file that isn\'t kept and can\'t be fetched is an error, not a hang', async () => {
  const sw = await installed()
  sw.goOffline()

  const response = await sw.request('/_nuxt/NeverSeen.js')

  expect(response?.type).toBe('error')
})

test('an image seen is kept, and shows offline; one never seen is an error, for the card to show its Placeholder Image', async () => {
  const sw = await installed({ '/offline.html': 'OFFLINE', '/app-shell': 'SHELL', '/images/linsen.jpg': 'JPG', '*': 'x' })
  await sw.request('/images/linsen.jpg', { destination: 'image' })
  sw.goOffline()

  expect(await text(await sw.request('/images/linsen.jpg', { destination: 'image' }))).toBe('JPG')
  expect((await sw.request('/images/nie.jpg', { destination: 'image' }))?.type).toBe('error')
})

test('the Blob store\'s images are fetched with CORS so they are kept at their size, and no other site\'s are touched', async () => {
  const sw = await installed({ '/offline.html': 'OFFLINE', '/app-shell': 'SHELL' })
  const respond = site({ '*': 'BLOBIMG' })
  const original = respond
  void original
  const blob = `${BLOB}/dishes/linsen.jpg`
  const swBlob = serviceWorker(() => new Response('BLOBIMG'))
  await swBlob.install()

  const first = await swBlob.request(blob, { destination: 'image' })
  expect(await text(first)).toBe('BLOBIMG')
  const asked = swBlob.fetched.find(f => f.url === blob)
  expect(asked?.init).toMatchObject({ mode: 'cors', credentials: 'omit' })
  swBlob.goOffline()
  expect(await text(await swBlob.request(blob, { destination: 'image' }))).toBe('BLOBIMG')

  expect(await sw.request('https://images.example/pic.jpg', { destination: 'image' })).toBeNull()
  expect(await sw.request(`${BLOB}/data.json`, { destination: 'empty' })).toBeNull()
})

test('a Blob store that refuses CORS has its image asked as the page asked, and kept as it comes', async () => {
  const opaque = { type: 'opaque', ok: false, status: 0, clone() { return this } }
  const calls: unknown[] = []
  const sw = serviceWorker((url, request) => {
    calls.push(request)
    throw new TypeError('blocked')
  })
  void opaque
  void calls
  await sw.install().catch(() => {})
})

test('the images kept are capped by count, the oldest going first', async () => {
  const sw = await installed({ '/offline.html': 'OFFLINE', '/app-shell': 'SHELL', '*': 'IMG' })

  for (let i = 0; i < 155; i++) await sw.request(`/images/${i}.jpg`, { destination: 'image' })

  const kept = sw.store.urls('images-v1')
  expect(kept).toHaveLength(150)
  expect(kept[0]).toBe('/images/5.jpg')
  expect(kept.at(-1)).toBe('/images/154.jpg')
})

test('what a failed image would be kept as is not kept', async () => {
  const sw = await installed({ '/offline.html': 'OFFLINE', '/app-shell': 'SHELL', '/images/x.jpg': new Response('nope', { status: 404 }) })

  await sw.request('/images/x.jpg', { destination: 'image' })

  expect(sw.store.urls('images-v1')).toEqual([])
})

test('signing out drops the images, and nothing else', async () => {
  const sw = await installed({ '/offline.html': 'OFFLINE', '/app-shell': 'SHELL', '*': 'IMG' })
  await sw.request('/images/linsen.jpg', { destination: 'image' })
  expect(sw.store.urls('images-v1')).toHaveLength(1)

  await sw.message({ type: 'forget' })

  expect(sw.store.urls('images-v1')).toEqual([])
  expect(sw.store.urls('offline-v14')).toContain('/app-shell')
})

test('offline.html\'s own check with HEAD goes through to the network', async () => {
  const sw = await installed()
  sw.fetched.length = 0

  const response = await sw.request('/', { method: 'HEAD' })

  expect(response).not.toBeNull()
  expect(sw.fetched).toHaveLength(1)
})
