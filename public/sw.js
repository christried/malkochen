// malkochen's service worker: only the fallback page (PRD story 8). A page
// that can't be loaded gets offline.html instead of the browser's own error,
// and that page tells apart the two reasons: the device has no connection
// ("Du bist offline"), or it has one but malkochen doesn't answer ("nicht
// erreichbar", our side). Nothing else is cached: Boards and Dishes always
// come from the network. Bump VERSION when offline.html or what it shows
// changes.
const VERSION = 'offline-v3'
const FALLBACK_PAGE = '/offline.html'
// The offline clip (still and video, both themes) plays on the Offline page
// and the app's Offline screen, which both show only without a connection.
const OFFLINE_CLIP = ['light', 'dark'].flatMap(theme => ['png', 'webm', 'mp4'].map(ext => `/clips/offline-${theme}.${ext}`))
const PRECACHED = [FALLBACK_PAGE, '/illustrations/topfbert-oops.svg', ...OFFLINE_CLIP]

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
  if (request.method !== 'GET') return
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => isPlatformError(response) ? fallback(FALLBACK_PAGE) : response)
        .catch(() => fallback(FALLBACK_PAGE)),
    )
    return
  }
  // What the fallback page itself shows: the network first, so it stays fresh.
  const { origin, pathname } = new URL(request.url)
  if (origin === self.location.origin && PRECACHED.includes(pathname)) {
    event.respondWith(fetch(request).catch(() => fallback(pathname)))
  }
})
