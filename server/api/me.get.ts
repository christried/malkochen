// The signed-in user. Guarded like every /api/** route, so the page guard
// (app/middleware/auth.global.ts) gets 401 when signed out and 403 when the
// Allowlist no longer includes the user -- which get-session can't tell it.
export default defineEventHandler((event) => {
  const { id, name, email } = requireUser(event)
  return { id, name, email }
})
