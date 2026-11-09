import type { Connection } from '~/composables/useConnection'

// Keeps useConnection's state (#458) from what the app's requests to
// malkochen (/api) get: one that gets no answer makes it offline, or
// unreachable if the browser says it has a connection; the next that gets an
// answer makes it online again. A Vercel platform error (a 5xx with
// x-vercel-error, as the service worker tells them apart) is no answer from
// malkochen. Watched at the browser's fetch, which $fetch and useFetch call
// for every request (the app's $fetch is bound as it loads, so it can't be
// swapped for one with hooks). The browser going offline says so at once;
// coming back online, one cheap request asks whether malkochen answers (the
// open Board's version checks keep asking too). Only once the app has
// mounted, so hydration renders as the server did.
export default defineNuxtPlugin((nuxtApp) => {
  const state = useConnectionState()
  let mounted = false
  // What a request found before the app mounted.
  let found: Connection = 'online'

  function set(connection: Connection) {
    const next = navigator.onLine ? connection : 'offline'
    if (mounted) state.value = next
    else found = next
  }

  const isPlatformError = (response: Response) => response.status >= 500 && response.headers.has('x-vercel-error')
  // An address fetch can't read is left to fetch, to fail as it would.
  const toMalkochen = (input: RequestInfo | URL) => {
    try {
      const url = new URL(input instanceof Request ? input.url : input, location.href)
      return url.origin === location.origin && url.pathname.startsWith('/api/')
    }
    catch {
      return false
    }
  }

  const fetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    if (!toMalkochen(input)) return fetch(input, init)
    try {
      const response = await fetch(input, init)
      set(isPlatformError(response) ? 'unreachable' : 'online')
      return response
    }
    catch (error) {
      // Called off by the app (a search typed on), not unanswered.
      if ((error as Error | null)?.name !== 'AbortError') set('unreachable')
      throw error
    }
  }

  window.addEventListener('offline', () => set('offline'))
  window.addEventListener('online', () => {
    void $fetch('/api/health').catch(() => {})
  })
  nuxtApp.hook('app:mounted', () => {
    mounted = true
    set(found)
  })
})
