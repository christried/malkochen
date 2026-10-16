import { expect, test } from 'vitest'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'

// The Tour (CONTEXT.md, #298) shows once per person, not per device: the
// user record keeps the highest Tour version they finished or skipped.
// /api/me reports it; PUT /api/me/tour records one, and only ever raises it.
// The users below are used by this file only.

const KOVALEVSKAYA = ALLOWLISTED[71]
const GERMAIN = ALLOWLISTED[72]
const AGNESI = ALLOWLISTED[73]

interface Me { tourSeen: number | null }

const me = async (caller: Caller): Promise<Me> => (await caller.fetch('/api/me')).json()

function record(caller: Caller, version: unknown) {
  return caller.fetch('/api/me/tour', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version }),
  })
}

test('a new user has seen no Tour', async () => {
  const kovalevskaya = await signIn(KOVALEVSKAYA)

  expect((await me(kovalevskaya)).tourSeen).toBeNull()
})

test('recording a version keeps it, for every device the user signs in on', async () => {
  const germain = await signIn(GERMAIN)

  const res = await record(germain, 2)

  expect(res.status).toBe(200)
  expect((await res.json() as Me).tourSeen).toBe(2)
  const otherDevice = await signIn(GERMAIN)
  expect((await me(otherDevice)).tourSeen).toBe(2)
})

test('a lower version than the one kept changes nothing; a higher one raises it', async () => {
  const agnesi = await signIn(AGNESI)
  await record(agnesi, 3)

  expect((await (await record(agnesi, 1)).json() as Me).tourSeen).toBe(3)
  expect((await me(agnesi)).tourSeen).toBe(3)

  await record(agnesi, 4)
  expect((await me(agnesi)).tourSeen).toBe(4)
})

test.each([
  ['no version', undefined],
  ['a version that isn\'t a whole number', 1.5],
  ['a version below 1', 0],
  ['text', 'eins'],
])('%s is refused (400)', async (_, version) => {
  const kovalevskaya = await signIn(KOVALEVSKAYA)

  expect((await record(kovalevskaya, version)).status).toBe(400)
  expect((await me(kovalevskaya)).tourSeen).toBeNull()
})

test('signed out, recording is refused (401)', async () => {
  expect((await record(anonymous(), 1)).status).toBe(401)
})
