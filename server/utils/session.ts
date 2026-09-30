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

// A Board id from the route. Anything that isn't a UUID can't be a Board.
export function boardIdParam(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID.test(id)) throw createError({ statusCode: 404, statusMessage: 'Board not found' })
  return id
}
