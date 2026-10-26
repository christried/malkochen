import { sql, type SQL } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { user } from '../db/schema'
import { parseServerEnv } from '../env'

const { OPERATOR_EMAIL } = parseServerEnv(process.env)

// The Operator (CONTEXT.md, #348): the one user whose email is
// OPERATOR_EMAIL, and the only one the Admin Page is for.
export function isOperator(email: string): boolean {
  return OPERATOR_EMAIL !== '' && email.trim().toLowerCase() === OPERATOR_EMAIL.trim().toLowerCase()
}

// Whether the user with this id is the Operator, as SQL to filter on: for the
// one access check (server/utils/board-access.ts, ADR 0009).
export function isOperatorUser(userId: string): SQL<boolean> {
  const email = OPERATOR_EMAIL.trim().toLowerCase()
  if (email === '') return sql<boolean>`false`
  return sql<boolean>`exists (select 1 from ${user} where ${user.id} = ${userId} and lower(${user.email}) = ${email})`
}

// What the Admin Page's endpoints answer anyone but the Operator: there is
// nothing there.
export function adminNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Page not found' })
}

// The one check before every admin endpoint. The signed-out never get this
// far: server/middleware/auth.ts answers them the same.
export function requireOperator(event: H3Event): void {
  const user = event.context.user
  if (!user || !isOperator(user.email)) throw adminNotFound()
}
