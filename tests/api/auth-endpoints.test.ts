import { beforeAll, describe, expect, inject, test } from 'vitest'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'

// Better Auth mounts all its built-in endpoints under /api/auth/**. malkochen
// uses only Google sign-in (and its callback), get-session, sign-out and, in
// tests, the dev sign-in; every other path is turned off (#191): the other
// built-in endpoints of better-auth 1.7.6, and any a later version adds.
const DISABLED = [
  '/ok',
  '/error',
  '/callback/github',
  '/reset-password/a-token',
  '/update-user',
  '/update-session',
  '/change-email',
  '/delete-user',
  '/delete-user/callback',
  '/link-social',
  '/unlink-account',
  '/list-accounts',
  '/account-info',
  '/get-access-token',
  '/refresh-token',
  '/list-sessions',
  '/revoke-session',
  '/revoke-sessions',
  '/revoke-other-sessions',
  '/sign-up/email',
  '/sign-in/email',
  '/change-password',
  '/set-password',
  '/verify-password',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
  '/verify-email',
]

// A JSON POST as a browser sends it: Better Auth refuses cookie-carrying
// POSTs without an Origin.
function post(caller: Caller, path: string, body: unknown = {}) {
  return caller.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': inject('apiBaseUrl') },
    body: JSON.stringify(body),
  })
}

async function me(caller: Caller) {
  return (await caller.fetch('/api/me')).json() as Promise<{ name: string, image: string | null }>
}

describe('Better Auth endpoints malkochen does not use', () => {
  test('update-user answers 404 for a signed-in user and changes neither name nor image', async () => {
    const hilde = await signIn(ALLOWLISTED[33], { name: 'Hilde', image: 'https://lh3.googleusercontent.com/a/hilde' })

    const res = await post(hilde, '/api/auth/update-user', { name: 'Ada', image: 'https://attacker.example/pixel.gif' })

    expect(res.status).toBe(404)
    expect(await me(hilde)).toMatchObject({ name: 'Hilde', image: 'https://lh3.googleusercontent.com/a/hilde' })
  })

  test('update-user stays off however its path is written', async () => {
    const marie = await signIn(ALLOWLISTED[34], { name: 'Marie' })

    for (const path of ['/api/auth/update-user/', '/api/auth/update%2Duser', '/api/auth//update-user', '/api/auth/Update-User']) {
      const res = await post(marie, path, { name: 'Ada' })
      expect(res.ok, `${path} answered ${res.status}`).toBe(false)
    }
    expect((await me(marie)).name).toBe('Marie')
  })

  let emilie: Caller
  beforeAll(async () => {
    emilie = await signIn(ALLOWLISTED[35])
  })

  test.each(DISABLED)('%s answers 404 to a signed-in user', async (path) => {
    expect((await post(emilie, `/api/auth${path}`)).status).toBe(404)
    expect((await emilie.fetch(`/api/auth${path}`)).status).toBe(404)
  })
})

describe('Better Auth endpoints malkochen uses', () => {
  test('Google sign-in still hands out the Google sign-in address', async () => {
    const res = await post(anonymous(), '/api/auth/sign-in/social', { provider: 'google', callbackURL: '/' })

    expect(res.status).toBe(200)
    expect((await res.json()).url).toMatch(/^https:\/\/accounts\.google\.com\//)
  })

  test('the Google callback is still there: without a sign-in in progress it sends you to the sign-in page', async () => {
    const res = await anonymous().fetch('/api/auth/callback/google', { redirect: 'manual' })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toMatch(/\/login\?error=/)
  })

  test('sign-out still ends the session', async () => {
    const rachel = await signIn(ALLOWLISTED[36])

    expect((await post(rachel, '/api/auth/sign-out')).status).toBe(200)
    expect(await (await rachel.fetch('/api/auth/get-session')).json()).toBeNull()
  })
})
