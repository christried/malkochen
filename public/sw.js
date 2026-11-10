// malkochen's service worker: opening the app without a connection (#461,
// PRD story 8 before it), and push notifications (#219, at the end).
//
// Navigations go to the network first. Without an answer, an app address
// (the start, a Board or a Dish, the share target) gets the app shell: a
// page that boots the app in the browser alone (/app-shell, rendered without
// the server), which then shows what the device kept (the Boards in
// IndexedDB). Nothing else is kept as a page: a page rendered by the server
// carries its data, which would be stale next to what the device keeps. Any
// other address, and an app address while the shell isn't there yet, gets
// offline.html instead of the browser's own error, and that page tells apart
// the two reasons: the device has no connection ("Du bist offline"), or it
// has one but malkochen doesn't answer ("nicht erreichbar", our side).
//
// What the app is built from is kept as it is fetched: /_nuxt/ and /_fonts/
// files, cache-first when their names carry a hash. Images are kept as they
// are seen (the Dishes' own, and the Blob store's), in a cache capped by
// entry count, the oldest going first; best effort, as a Dish whose image is
// missing shows its Placeholder Image. The Placeholder Images and the
// offline clip are always kept. The API is never cached here: Boards live
// in the device store (app/board/device-store.ts), and this worker never
// sees what is in them.
// Bump VERSION when offline.html, the shell or what is precached changes.
const VERSION = 'offline-v14'
// Built files, and images. Their names stay across versions: what they hold
// is fetched by its own name or hash.
const ASSETS = 'assets-v1'
const IMAGES = 'images-v1'
const FALLBACK_PAGE = '/offline.html'
const SHELL = '/app-shell'
// How many images, and built files, are kept at most.
const IMAGE_LIMIT = 150
const ASSET_LIMIT = 1500
// The offline clip's drawings (both themes), which the app's Offline screen
// plays (SvgLoop) and shows only without a connection. The Offline page has
// the drawing in it.
const OFFLINE_CLIP = ['light', 'dark'].map(theme => `/clips/offline-${theme}.svg`)
// The fonts the fallback page is set in: fixed copies, as the app's own have
// hashed names (offline.html).
const OFFLINE_FONTS = ['figtree', 'petrona'].flatMap(font => ['latin', 'latin-ext'].map(subset => `/fonts/${font}-${subset}.woff2`))
// The Placeholder Images (public/placeholders, shared/placeholders.ts), which
// a Dish without its image shows.
const PLACEHOLDERS = ['pasta', 'ramen', 'bowl', 'breakfast', 'burger', 'tacos', 'wok', 'bread', 'cake', 'dumplings', 'smoothie', 'eintopf']
  .flatMap(name => ['light', 'dark'].map(theme => `/placeholders/${name}-${theme}.svg`))
// The fallback page needs all of these to install; the rest is best effort.
const PRECACHED = [FALLBACK_PAGE, ...OFFLINE_CLIP, ...OFFLINE_FONTS]
const BEST_EFFORT = [SHELL, ...PLACEHOLDERS]
// Files from public/ the app shows (the drawings, icons): kept as seen.
const STATIC_PREFIXES = ['/placeholders/', '/clips/', '/illustrations/', '/icons/', '/fonts/', '/snackbert/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then(async (cache) => {
        await cache.addAll(PRECACHED)
        await Promise.all(BEST_EFFORT.map(path => cache.add(path).catch(() => {})))
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const current = [VERSION, ASSETS, IMAGES]
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => !current.includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

// Signing out or deleting the account (app/plugins/device.client.ts): the
// images seen on the user's Boards go with everything else kept.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'forget') event.waitUntil(caches.delete(IMAGES))
})

async function fallback(pathname) {
  return (await caches.match(pathname)) ?? Response.error()
}

// Vercel's own error pages (the function crashed or timed out, the platform
// is down) carry x-vercel-error; malkochen's error screen never does, and
// shows itself.
const isPlatformError = response => response.status >= 500 && response.headers.has('x-vercel-error')

// The app's own addresses, which the shell can open: the start, a Board, a
// Dish (also by its old address), the share target. Not the Board's
// settings: they need malkochen.
function isAppPath(pathname) {
  if (pathname === '/' || pathname === '/share') return true
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'b' || parts.length < 2) return false
  if (parts.length === 2) return true
  if (parts.length === 3) return parts[2] !== 'settings'
  return parts.length === 4 && parts[2] === 'd'
}

// A page that couldn't be loaded: the app shell for an app address, else
// the Offline page.
async function unavailable(pathname) {
  if (isAppPath(pathname)) {
    const shell = await caches.match(SHELL)
    if (shell) return shell
  }
  return fallback(FALLBACK_PAGE)
}

// The shell is kept fresh with every page that loads, at most every few
// minutes, so it matches the build the app's files come from.
let shellKeptAt = 0
async function keepShell() {
  if (Date.now() - shellKeptAt < 5 * 60_000) return
  shellKeptAt = Date.now()
  try {
    const cache = await caches.open(VERSION)
    await cache.add(SHELL)
  }
  catch {
    shellKeptAt = 0
  }
}

async function navigation(event) {
  const { pathname } = new URL(event.request.url)
  try {
    const response = await fetch(event.request)
    if (isPlatformError(response)) return unavailable(pathname)
    if (response.ok && isAppPath(pathname)) event.waitUntil(keepShell())
    return response
  }
  catch {
    return unavailable(pathname)
  }
}

// Drops the oldest entries (a cache lists them in the order they were put)
// until `limit` are left.
async function trim(cache, limit) {
  const keys = await cache.keys()
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key)
}

async function keep(cacheName, request, response, limit) {
  try {
    const cache = await caches.open(cacheName)
    await cache.put(request, response)
    await trim(cache, limit)
  }
  catch {
    // Full, or a response that can't be kept: best effort.
  }
}

// The names of built files carry a hash of their content: a hit is current.
const HASHED = /(?:^|[./])[A-Za-z0-9_-]{8}\.(?:js|css|woff2?|png|jpe?g|webp|svg)$/
const isImmutable = url => url.pathname.startsWith('/_nuxt/fonts/') || (url.pathname.startsWith('/_nuxt/') && url.search === '' && HASHED.test(url.pathname))

// Built files: from the cache first if their name is a hash, else from the
// network first (a development server's modules change under the same
// name). Kept as they are fetched.
async function built(request, url) {
  const cache = await caches.open(ASSETS)
  if (isImmutable(url)) {
    const hit = await cache.match(request)
    if (hit) return hit
  }
  try {
    const response = await fetch(request)
    if (response.ok) await keep(ASSETS, request, response.clone(), ASSET_LIMIT)
    return response
  }
  catch {
    return (await cache.match(request)) ?? Response.error()
  }
}

// Files from public/ and what the fallback page itself shows: the network
// first, so they stay fresh.
async function shown(request, url) {
  try {
    const response = await fetch(request)
    if (response.ok) await keep(ASSETS, request, response.clone(), ASSET_LIMIT)
    return response
  }
  catch {
    return (await caches.match(request)) ?? fallback(url.pathname)
  }
}

// The Blob store, where the Image Store keeps the Dishes' images.
const isBlobStore = url => url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com')

// An image seen on a Board: from the cache if kept, else fetched and kept.
// The Blob store's are asked with CORS so what is kept has its real size (an
// opaque response counts as megabytes against the storage quota); if that is
// refused, the image is asked as the page asked, and kept opaque. One that
// can't be had is an error, which the card answers with its Placeholder Image.
async function image(request, url) {
  const cache = await caches.open(IMAGES)
  const hit = await cache.match(request)
  if (hit) return hit
  try {
    const response = url.origin === self.location.origin
      ? await fetch(request)
      : await fetch(url.href, { mode: 'cors', credentials: 'omit' }).catch(() => fetch(request))
    if (response.ok || response.type === 'opaque') await keep(IMAGES, request, response.clone(), IMAGE_LIMIT)
    return response
  }
  catch {
    return Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  // offline.html asks with HEAD whether malkochen answers: through here, the
  // way its reload will go.
  if (request.method === 'HEAD') {
    event.respondWith(fetch(request))
    return
  }
  if (request.method !== 'GET') return
  if (request.mode === 'navigate') {
    event.respondWith(navigation(event))
    return
  }
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    if (request.destination === 'image' && isBlobStore(url)) event.respondWith(image(request, url))
    return
  }
  const { pathname } = url
  // Never the API: Boards come from malkochen, or from the device store.
  if (pathname.startsWith('/api/')) return
  if (pathname.startsWith('/_nuxt/') || pathname.startsWith('/_fonts/')) {
    event.respondWith(built(request, url))
    return
  }
  if (PRECACHED.includes(pathname) || STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    event.respondWith(shown(request, url))
    return
  }
  if (request.destination === 'image') event.respondWith(image(request, url))
})

// Push notifications (#219): the server pushes one message per Board
// (server/push/index.ts), shown as the Board's one notification: a newer one
// replaces it (same tag) and alerts again.
self.addEventListener('push', (event) => {
  let message = null
  try {
    message = event.data?.json()
  }
  catch {
    // Not one of the app's pushes.
  }
  if (typeof message?.title !== 'string' || typeof message.tag !== 'string') return
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    tag: message.tag,
    renotify: true,
    // The Dish's picture, or the app icon for a Placeholder Image; the
    // malkochen mark in the status bar.
    icon: typeof message.image === 'string' ? message.image : '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    lang: typeof message.lang === 'string' ? message.lang : 'de',
    data: { url: message.url },
  }))
})

// Its address in the app, as a path (and the part of the page, as in a
// Dish at its Verlauf): one elsewhere opens the app's start.
function appPath(url) {
  if (typeof url !== 'string') return '/'
  const target = new URL(url, self.location.origin)
  return target.origin === self.location.origin ? target.pathname + target.search + target.hash : '/'
}

// A tap opens the Dish or Board it is about: in the app window that is open
// (focused, and told where to go, so it doesn't load again), or a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = appPath(event.notification.data?.url)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (!open) return self.clients.openWindow(path)
    await open.focus()
    open.postMessage({ type: 'open', url: path })
  })())
})
