import { describe, expect, test } from 'vitest'
import { ALLOWLISTED, anonymous, devSignIn, signIn } from './client'

describe('sign-in', () => {
  test('an Allowlisted email gets a session', async () => {
    const ada = await signIn(ALLOWLISTED[0])

    const res = await ada.fetch('/api/auth/get-session')
    expect((await res.json()).user.email).toBe(ALLOWLISTED[0])
  })

  test('the Allowlist ignores letter case', async () => {
    const res = await devSignIn('Grace@Example.COM')
    expect(res.status).toBe(200)
  })

  test('an email not on the Allowlist is refused with "not_allowed" and gets no session', async () => {
    const res = await devSignIn('stranger@example.com')

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_allowed')
    expect(res.headers.getSetCookie()).toEqual([])
  })

  test('the API refuses callers without a session', async () => {
    const res = await anonymous().fetch('/api/boards/landing')
    expect(res.status).toBe(401)
  })
})
