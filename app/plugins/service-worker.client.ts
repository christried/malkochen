// Registers public/sw.js, which opens malkochen without a connection (the
// app shell, #461) or shows the Offline page. Once the page has loaded, so it
// never competes with the first render.
//
// The worker keeps the app's built files as they are fetched. A first visit
// loaded them before the worker took control, and a page not opened yet has
// its files not loaded: so once it is in control, this fetches what the page
// loaded again, through the worker, and loads the files of the pages the shell
// opens (the start, a Board, a Dish, the share target). The first, in the
// browser tests, only if the page asks (window.e2eSeedOffline): the
// development server has hundreds of files, which would slow every test.
export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return
  const e2e = useRuntimeConfig().public.e2e
  async function keepForOffline() {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
    }
    if (!navigator.onLine) return
    if (!e2e || (window as { e2eSeedOffline?: boolean }).e2eSeedOffline) {
      // Not the stylesheets: the worker keeps those as the page's <link>s ask
      // for them (a script fetching one would be kept as a script).
      const loaded = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter(entry => entry.initiatorType !== 'link' && entry.initiatorType !== 'css')
        .map(entry => entry.name)
        .filter(name => /\/(?:_nuxt|_fonts)\//.test(name))
      await Promise.allSettled(loaded.map(name => fetch(name)))
    }
    for (const path of ['/', '/share', '/b/kept', '/b/kept/dish']) await preloadRouteComponents(path).catch(() => {})
  }
  const register = () => navigator.serviceWorker.register('/sw.js')
    .then(() => {
      void keepForOffline().catch(() => {})
    })
    .catch((error: unknown) => {
      console.warn('[service-worker] not registered:', error)
    })
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })

  // A tapped push notification (#219) opens its Dish or Board here when the
  // app is open already; the service worker only says which.
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent<{ type?: string, url?: unknown }>) => {
    const { type, url } = event.data ?? {}
    if (type === 'open' && typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) void navigateTo(url)
  })
  // Not only once the page has loaded: a tap can come before.
  navigator.serviceWorker.startMessages()
})
