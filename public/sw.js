// malkochen's service worker: the fallback page (PRD story 8), and push
// notifications (#219, at the end). A page that can't be loaded gets
// offline.html instead of the browser's own error, and that page tells apart
// the two reasons: the device has no connection ("Du bist offline"), or it
// has one but malkochen doesn't answer ("nicht erreichbar", our side).
// Nothing else is cached: Boards and Dishes always come from the network.
// Bump VERSION when offline.html or what it shows changes.
const VERSION = 'offline-v13'
const FALLBACK_PAGE = '/offline.html'
// The offline clip's drawings (both themes), which the app's Offline screen
// plays (SvgLoop) and shows only without a connection. The Offline page has
// the drawing in it.
const OFFLINE_CLIP = ['light', 'dark'].map(theme => `/clips/offline-${theme}.svg`)
// The fonts the fallback page is set in: fixed copies, as the app's own have
// hashed names (offline.html).
const OFFLINE_FONTS = ['figtree', 'petrona'].flatMap(font => ['latin', 'latin-ext'].map(subset => `/fonts/${font}-${subset}.woff2`))
const PRECACHED = [FALLBACK_PAGE, ...OFFLINE_CLIP, ...OFFLINE_FONTS]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(PRECACHED)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function fallback(pathname) {
  return (await caches.match(pathname)) ?? Response.error()
}

// Vercel's own error pages (the function crashed or timed out, the platform
// is down) carry x-vercel-error; malkochen's error screen never does, and
// shows itself.
const isPlatformError = response => response.status >= 500 && response.headers.has('x-vercel-error')

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
    event.respondWith(
      fetch(request)
        .then(response => isPlatformError(response) ? fallback(FALLBACK_PAGE) : response)
        .catch(() => fallback(FALLBACK_PAGE)),
    )
    return
  }
  const { origin, pathname } = new URL(request.url)
  if (origin !== self.location.origin) return
  // What the fallback page itself shows: the network first, so it stays fresh.
  if (PRECACHED.includes(pathname)) {
    event.respondWith(fetch(request).catch(() => fallback(pathname)))
  }
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
    lang: 'de',
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
