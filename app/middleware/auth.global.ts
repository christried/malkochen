// Page guard: signed-out visitors go to /login, signed-in ones never see it.
// The API has its own boundary (server/middleware/auth.ts); this only decides
// which page to show.
export default defineNuxtRouteMiddleware(async (to) => {
  // A relative URL on purpose: during server rendering Nuxt then calls the
  // auth API in-process with the visitor's cookies.
  const { data: session } = await useFetch('/api/auth/get-session', { key: `session:${to.fullPath}` })
  const signedIn = Boolean(session.value)

  if (to.path === '/login') {
    // A refused sign-in lands on /login?error=... without a session; a
    // signed-in user has no business on the sign-in screen.
    if (signedIn) return navigateTo('/')
    return
  }
  if (!signedIn) return navigateTo('/login')
})
