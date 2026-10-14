// Registers public/sw.js, which shows the Offline page when malkochen is
// opened without a connection. Once the page has loaded, so it never
// competes with the first render.
export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return
  const register = () => navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
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
