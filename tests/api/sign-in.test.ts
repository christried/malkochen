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

  test('a sign-in whose email Google has not verified is refused like one off the Allowlist', async () => {
    const res = await devSignIn(ALLOWLISTED[37], { emailVerified: false })

    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('not_allowed')
    expect(res.headers.getSetCookie()).toEqual([])
  })

  test('the API refuses callers without a session', async () => {
    expect((await anonymous().fetch('/api/boards/landing')).status).toBe(401)
    expect((await anonymous().fetch('/api/me')).status).toBe(401)
  })

  test('/api/me tells a signed-in user who they are', async () => {
    const ada = await signIn(ALLOWLISTED[0])

    const res = await ada.fetch('/api/me')
    expect(res.status).toBe(200)
    expect((await res.json()).email).toBe(ALLOWLISTED[0])
  })

  test("/api/me also gives the user's name and Google photo, for their settings", async () => {
    const ruth = await signIn(ALLOWLISTED[17], { name: 'Ruth', image: 'https://lh3.googleusercontent.com/a/ruth' })

    const me = await (await ruth.fetch('/api/me')).json()
    expect(me).toMatchObject({ name: 'Ruth', email: ALLOWLISTED[17], image: 'https://lh3.googleusercontent.com/a/ruth' })
  })
})
