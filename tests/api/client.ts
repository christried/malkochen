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

// A browser that keeps every cookie the server sets or clears, before and
// after signing in -- for state that must survive a sign-in, like a
// remembered invite.
export interface Browser extends Caller {
  signIn: (email: string) => Promise<Response>
  cookie: (name: string) => string | undefined
}

export function browser(): Browser {
  const jar = new Map<string, string>()
  const fetchKeeping = async (path: string, init?: RequestInit) => {
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
    const res = await fetch(`${inject('apiBaseUrl')}${path}`, { ...init, headers: { ...init?.headers, cookie } })
    for (const set of res.headers.getSetCookie()) {
      const [pair = ''] = set.split(';')
      const name = pair.slice(0, pair.indexOf('='))
      const value = pair.slice(pair.indexOf('=') + 1)
      if (value === '' || /max-age=0\b/i.test(set)) jar.delete(name)
      else jar.set(name, value)
    }
    return res
  }
  return {
    fetch: fetchKeeping,
    signIn: email => fetchKeeping('/api/auth/dev/sign-in', devSignInInit(email)),
    cookie: name => jar.get(name),
  }
}

function devSignInInit(email: string): RequestInit {
  return {
    method: 'POST',
    // What a browser sends; Better Auth refuses cookie-carrying POSTs without it.
    headers: { 'content-type': 'application/json', 'origin': inject('apiBaseUrl') },
    body: JSON.stringify({ email }),
  }
}

export function devSignIn(email: string): Promise<Response> {
  return anonymous().fetch('/api/auth/dev/sign-in', devSignInInit(email))
}
