import { expect, test } from 'vitest'
import { TEST_VERSION } from '../support/test-version'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { setVersionSeen } from './time-travel'

// The Version (CONTEXT.md, #354): the user record keeps the last one the
// user opened the Changelog in. /api/me says whether the app's is newer, so
// Your Settings marks "Was ist neu" with "Neu"; PUT /api/me/version-seen
// records the app's own. The users below are used by this file only.

const BABBAGE = ALLOWLISTED[130]
const BOOLE = ALLOWLISTED[131]
const SHANNON = ALLOWLISTED[132]

interface Me { newVersion: boolean }

const me = async (caller: Caller): Promise<Me> => (await caller.fetch('/api/me')).json()

const recordSeen = (caller: Caller) => caller.fetch('/api/me/version-seen', { method: 'PUT' })

test('a new user has a newer Version to see', async () => {
  const babbage = await signIn(BABBAGE)

  expect((await me(babbage)).newVersion).toBe(true)
})

test('once seen, it is no longer new, on every device the user signs in on', async () => {
  const boole = await signIn(BOOLE)

  const res = await recordSeen(boole)

  expect(res.status).toBe(200)
  expect((await res.json() as Me).newVersion).toBe(false)
  const otherDevice = await signIn(BOOLE)
  expect((await me(otherDevice)).newVersion).toBe(false)
})

test('a user who saw an older Version has a newer one to see, until they open it', async () => {
  const shannon = await signIn(SHANNON)
  await setVersionSeen(SHANNON, '1.2.2')
  expect((await me(shannon)).newVersion).toBe(true)

  await recordSeen(shannon)
  expect((await me(shannon)).newVersion).toBe(false)

  await setVersionSeen(SHANNON, TEST_VERSION)
  expect((await me(shannon)).newVersion).toBe(false)
})

test('signed out, recording is refused (401)', async () => {
  expect((await recordSeen(anonymous())).status).toBe(401)
})
