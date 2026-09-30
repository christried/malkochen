import type { H3Event } from 'h3'
import type { SessionUser } from './auth'

declare module 'h3' {
  interface H3EventContext {
    user?: SessionUser
  }
}

// The signed-in user of an /api/** request. server/middleware/auth.ts has
// already refused the request if there is none.
export function requireUser(event: H3Event): SessionUser {
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return user
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The one answer for a Board that doesn't exist or isn't the caller's: 404
// either way, so non-Members can't tell the two apart.
export function boardNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Board not found' })
}

// A Board id from the route. Anything that isn't a UUID can't be a Board.
export function boardIdParam(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID.test(id)) throw boardNotFound()
  return id
}

// Same for a Dish: one that doesn't exist and one on someone else's Board look alike.
export function dishNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Dish not found' })
}

// A Dish id from the route. Anything that isn't a UUID can't be a Dish.
export function dishIdParam(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID.test(id)) throw dishNotFound()
  return id
}

// Same for a Cooking: one that doesn't exist and one on someone else's Board look alike.
export function cookingNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Cooking not found' })
}

// A Cooking id from the route. Anything that isn't a UUID can't be a Cooking.
export function cookingIdParam(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID.test(id)) throw cookingNotFound()
  return id
}
