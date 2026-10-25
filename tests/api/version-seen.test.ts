import { expect, inject, test } from 'vitest'
import { startResendService } from '../support/resend-service'
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
const KAY = ALLOWLISTED[140]

interface Me { newVersion: boolean, versionSeen: string | null }

const me = async (caller: Caller): Promise<Me> => (await caller.fetch('/api/me')).json()

const recordSeen = (caller: Caller) => caller.fetch('/api/me/version-seen', { method: 'PUT' })

// A new account starts with the app's Version as seen (#406): the Changelog
// Popup is for what changed since they joined, not for what was there.
test('a new user starts with the app Version as seen, so there is nothing new to see', async () => {
  const babbage = await signIn(BABBAGE)

  expect(await me(babbage)).toMatchObject({ newVersion: false, versionSeen: TEST_VERSION })
})

test('so does a new user who signs in with an emailed code', async () => {
  const resend = await startResendService()
  try {
    const address = '2001:db8:406::1'
    const post = (path: string, body: unknown) => fetch(`${inject('apiBaseUrl')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'origin': inject('apiBaseUrl'), 'x-forwarded-for': address },
      body: JSON.stringify(body),
    })
    await post('/api/auth/email-otp/send-verification-otp', { email: KAY, type: 'sign-in' })
    const otp = resend.sent.findLast(e => e.to.includes(KAY))!.text.match(/\b\d{6}\b/)![0]
    const res = await post('/api/auth/sign-in/email-otp', { email: KAY, otp })
    expect(res.status).toBe(200)
    const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')

    const mine = await (await fetch(`${inject('apiBaseUrl')}/api/me`, { headers: { cookie } })).json() as Me
    expect(mine).toMatchObject({ newVersion: false, versionSeen: TEST_VERSION })
  }
  finally {
    await resend.close()
  }
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
