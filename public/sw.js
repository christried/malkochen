// malkochen's service worker: only the fallback page (PRD story 8). A page
// that can't be loaded gets offline.html instead of the browser's own error,
// and that page tells apart the two reasons: the device has no connection
// ("Du bist offline"), or it has one but malkochen doesn't answer ("nicht
// erreichbar", our side). Besides, the splash's two stills, so a cold
// launch paints them at once. Nothing else is cached: Boards and Dishes always
// come from the network. Bump VERSION when offline.html, what it shows, or a
// splash still changes.
const VERSION = 'offline-v4'
const FALLBACK_PAGE = '/offline.html'
// The offline clip (still and video, both themes) plays on the Offline page
// and the app's Offline screen, which both show only without a connection.
const OFFLINE_CLIP = ['light', 'dark'].flatMap(theme => ['png', 'webm', 'mp4'].map(ext => `/clips/offline-${theme}.${ext}`))
// The splash's poster (frame 10) and reduced-motion still (frame 16): from
// the cache first, as they show over the very first paint.
const SPLASH_STILLS = ['/clips/splash-poster.webp', '/clips/splash-still.webp']
const PRECACHED = [FALLBACK_PAGE, '/illustrations/topfbert-oops.svg', ...OFFLINE_CLIP, ...SPLASH_STILLS]

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

// The cached file, or the part a Range request asks for (as video players
// ask): Safari plays a video only from such 206 answers.
async function cachedPart(request, pathname) {
  const response = await fallback(pathname)
  const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get('range') ?? '')
  if (!range || !response.ok) return response
  const body = await response.arrayBuffer()
  const start = Number(range[1])
  const end = Math.min(range[2] ? Number(range[2]) : body.byteLength - 1, body.byteLength - 1)
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${body.byteLength}` } })
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${body.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  })
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
  const { origin, pathname } = new URL(request.url)
  if (origin !== self.location.origin) return
  if (SPLASH_STILLS.includes(pathname)) {
    event.respondWith(caches.match(pathname).then(cached => cached ?? fetch(request)))
    return
  }
  // What the fallback page itself shows: the network first, so it stays fresh.
  if (PRECACHED.includes(pathname)) {
    event.respondWith(fetch(request).catch(() => cachedPart(request, pathname)))
  }
})
