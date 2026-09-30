import { inject } from 'vitest'

// A signed-in (or anonymous) caller of the API, carrying its session cookie
// like a browser would.
export interface Caller {
  fetch: (path: string, init?: RequestInit) => Promise<Response>
}

export { ALLOWLISTED } from '../support/test-auth-env'

export function anonymous(): Caller {
  return { fetch: (path, init) => fetch(`${inject('apiBaseUrl')}${path}`, init) }
}

// Signs in through the dev bypass (same Allowlist gate and session creation as
// Google). Throws unless it succeeded; use devSignIn() to inspect a refusal.
export async function signIn(email: string): Promise<Caller> {
  const res = await devSignIn(email)
  if (!res.ok) throw new Error(`sign-in as ${email} failed: ${res.status} ${await res.text()}`)
  const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  return {
    fetch: (path, init) => fetch(`${inject('apiBaseUrl')}${path}`, {
      ...init,
      headers: { ...init?.headers, cookie },
    }),
  }
}

export function devSignIn(email: string): Promise<Response> {
  return anonymous().fetch('/api/auth/dev/sign-in', {
    method: 'POST',
    // What a browser sends; Better Auth refuses cookie-carrying POSTs without it.
    headers: { 'content-type': 'application/json', 'origin': inject('apiBaseUrl') },
    body: JSON.stringify({ email }),
  })
}
