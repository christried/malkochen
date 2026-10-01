// malkochen's service worker: only the fallback page (PRD story 8). A page
// that can't be loaded gets offline.html instead of the browser's own error,
// and that page tells apart the two reasons: the device has no connection
// ("Du bist offline"), or it has one but malkochen doesn't answer ("nicht
// erreichbar", our side). Nothing else is cached: Boards and Dishes always
// come from the network. Bump VERSION when offline.html or what it shows
// changes.
const VERSION = 'offline-v2'
const FALLBACK_PAGE = '/offline.html'
const PRECACHED = [FALLBACK_PAGE, '/illustrations/topfbert-sleep.svg', '/illustrations/topfbert-oops.svg']

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
