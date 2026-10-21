import type { H3Event } from 'h3'
import { chooseLanguage, type Language } from '../../shared/language'
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

// The language the server writes in for whoever made the request (#328):
// the signed-in user's choice under Sprache, else what their browser asks
// for, else English. Signed out, the browser alone.
export function callerLanguage(event: H3Event): Language {
  return chooseLanguage(event.context.user?.language, getRequestHeader(event, 'accept-language'))
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

// The same for someone the caller shares no Board with (the user popover,
// #213): they look like nobody at all.
export function personNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Person not found' })
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

// Same for a Column: one that doesn't exist and one on someone else's Board look alike.
export function columnNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Column not found' })
}

// A Column id from the route. Anything that isn't a UUID can't be a Column.
export function columnIdParam(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID.test(id)) throw columnNotFound()
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

// Same for a Comment: one that doesn't exist and one on someone else's Board look alike.
export function commentNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Comment not found' })
}

// A Comment id from the route. Anything that isn't a UUID can't be a Comment.
export function commentIdParam(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID.test(id)) throw commentNotFound()
  return id
}
