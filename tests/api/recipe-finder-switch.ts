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

// Runs `add` (a Dish added by the caller) with the Recipe Finder switched off
// for them if it was on, and on again after. A Dish a Recipe Finder user adds
// with a Source is searched by itself after adding (#503), which the tests of
// "Rezept finden" and the Recipe Finder's reading don't want to start.
export async function withoutSearchAfterAdding<T>(caller: Caller, add: () => Promise<T>): Promise<T> {
  const { state } = await (await caller.fetch('/api/me/recipe-finder')).json() as { state: string }
  if (state !== 'on') return add()
  await switchRecipeFinder(caller, false)
  try {
    return await add()
  }
  finally {
    await switchRecipeFinder(caller, true)
  }
}
