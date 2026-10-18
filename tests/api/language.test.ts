import { expect, test } from 'vitest'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'

// The language a user picks under Sprache in Your Settings (#326): stored on
// the user, so it follows them to every device, and carried in the session.
// "auto" (Automatisch) by default; PUT /api/me/language sets it. The users
// below are used by this file only.

const HOPPER = ALLOWLISTED[75]
const BARTIK = ALLOWLISTED[76]
const PAYNE = ALLOWLISTED[77]

interface Me { language: string }

const me = async (caller: Caller): Promise<Me> => (await caller.fetch('/api/me')).json()

function choose(caller: Caller, language: unknown) {
  return caller.fetch('/api/me/language', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language }),
  })
}

test('a new user\'s language is "auto"', async () => {
  const hopper = await signIn(HOPPER)

  expect((await me(hopper)).language).toBe('auto')
})

test('a chosen language is kept, for every device the user signs in on', async () => {
  const bartik = await signIn(BARTIK)

  const res = await choose(bartik, 'en')

  expect(res.status).toBe(200)
  expect((await res.json() as Me).language).toBe('en')
  const otherDevice = await signIn(BARTIK)
  expect((await me(otherDevice)).language).toBe('en')
})

test('Italian can be chosen (#327)', async () => {
  const payne = await signIn(PAYNE)

  const res = await choose(payne, 'it')

  expect(res.status).toBe(200)
  expect((await res.json() as Me).language).toBe('it')
  expect((await me(payne)).language).toBe('it')
})

test('the session carries it', async () => {
  const bartik = await signIn(BARTIK)
  await choose(bartik, 'de')

  const session = await (await bartik.fetch('/api/auth/get-session')).json() as { user: { language: string } }

  expect(session.user.language).toBe('de')
})

test('"auto" can be chosen again', async () => {
  const payne = await signIn(PAYNE)
  await choose(payne, 'de')

  expect((await (await choose(payne, 'auto')).json() as Me).language).toBe('auto')
  expect((await me(payne)).language).toBe('auto')
})

test.each([
  ['no language', undefined],
  ['a language malkochen doesn\'t speak', 'fr'],
  ['a regional tag', 'en-GB'],
  ['upper case', 'EN'],
  ['a number', 1],
])('%s is refused (400), and the language stays', async (_, language) => {
  const hopper = await signIn(HOPPER)

  expect((await choose(hopper, language)).status).toBe(400)
  expect((await me(hopper)).language).toBe('auto')
})

test('signed out, choosing is refused (401)', async () => {
  expect((await choose(anonymous(), 'en')).status).toBe(401)
})
