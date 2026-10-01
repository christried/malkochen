// malkochen's service worker: only the Offline page (PRD story 8). A page
// that can't be fetched because there's no connection gets offline.html
// instead of the browser's own error. Nothing else is cached: Boards and
// Dishes always come from the network. Bump VERSION when offline.html or
// what it shows changes.
const VERSION = 'offline-v1'
const OFFLINE_PAGE = '/offline.html'
const PRECACHED = [OFFLINE_PAGE, '/illustrations/topfbert-sleep.svg']

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

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_PAGE)) ?? Response.error()))
    return
  }
  // What the Offline page itself shows: the network first, so it stays fresh.
  const { origin, pathname } = new URL(request.url)
  if (origin === self.location.origin && PRECACHED.includes(pathname)) {
    event.respondWith(fetch(request).catch(async () => (await caches.match(pathname)) ?? Response.error()))
  }
})
