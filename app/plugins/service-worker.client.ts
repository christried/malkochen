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
})
