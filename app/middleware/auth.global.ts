// Page guard: signed-out visitors go to /login, someone no longer on the
// Allowlist to its "Not unlocked" screen, and a signed-in user never sees
// /login. The invite landing is open to everyone and decides for itself.
// The API has its own boundary (server/middleware/auth.ts); this only
// decides which page to show.
export default defineNuxtRouteMiddleware(async (to) => {
  // A relative URL on purpose: during server rendering Nuxt then calls the
  // API in-process with the visitor's cookies.
  const { error } = await useFetch('/api/me', { key: `me:${to.fullPath}` })
  const status = error.value?.statusCode

  if (to.path.startsWith('/invite/')) return
  if (to.path === '/login') {
    if (!error.value) return navigateTo('/')
    return
  }
  if (status === 403) return navigateTo({ path: '/login', query: { error: 'not_allowed' } })
  if (error.value) return navigateTo('/login')
})
