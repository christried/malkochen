// Page guard: signed-out visitors go to /login, someone no longer on the
// Allowlist to its "Not unlocked" screen, and a signed-in user never sees
// /login. A signed-in user who is still to pick or confirm their Username
// goes to /username first and is taken on from there; nobody else sees that
// page. The invite landing is open to everyone and decides for itself: it
// leads to the invited Board, which then sends them to /username. The
// Changelog, the Impressum and the Datenschutz are open to everyone too.
// The API has its own boundary (server/middleware/auth.ts); this only
// decides which page to show.
export default defineNuxtRouteMiddleware(async (to) => {
  // A relative URL on purpose: during server rendering Nuxt then calls the
  // API in-process with the visitor's cookies.
  const { data: me, error } = await useFetch('/api/me', { key: `me:${to.fullPath}` })
  const status = error.value?.statusCode
  // The language follows the signed-in user's choice; signed out, the
  // browser's languages alone. A failed check (offline) changes nothing.
  if (me.value) useLanguageChoice().value = me.value.language
  else if (status === 401) useLanguageChoice().value = 'auto'

  if (to.path.startsWith('/invite/')) return
  // The Changelog (#354) is for everyone, signed in or not.
  if (to.path === '/changelog') return
  // So are the Impressum and the Datenschutz (#391), linked from the sign-in screen.
  if (to.path === '/impressum' || to.path === '/datenschutz') return
  if (to.path === '/login') {
    if (!error.value) return navigateTo('/')
    return
  }
  if (status === 403) return navigateTo({ path: '/login', query: { error: 'not_allowed' } })
  // Something shared to malkochen (pages/share.vue) is kept through sign-in.
  if (error.value) return navigateTo(to.path === '/share' ? { path: '/login', query: { redirect: to.fullPath } } : '/login')

  const asked = Boolean(me.value?.usernamePrompt)
  if (to.path === '/username') {
    if (!asked) return navigateTo('/')
    return
  }
  if (asked) return navigateTo({ path: '/username', query: to.path === '/' ? {} : { redirect: to.fullPath } })
})
