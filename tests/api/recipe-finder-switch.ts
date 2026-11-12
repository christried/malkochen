import { expect } from 'vitest'
import { signIn, type Caller } from './client'
import { OPERATOR } from '../support/test-auth-env'

// The Operator switches the Recipe Finder on or off for the caller
// (`PUT /api/admin/recipe-finder/:id`, #497), as the tests of the Recipe
// Finder need before they act as a user it is on for.
export async function switchRecipeFinder(caller: Caller, on: boolean): Promise<void> {
  const { id } = await (await caller.fetch('/api/me')).json() as { id: string }
  const operator = await signIn(OPERATOR)
  const res = await operator.fetch(`/api/admin/recipe-finder/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ on }),
  })
  expect(res.status).toBe(200)
}
