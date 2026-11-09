// Snackbert (CONTEXT.md, #423), the Operator's nutrition app, as malkochen
// asks it whether an email address has an account there. Pure apart from
// that request, and no database: who is asked, and what the answer does, is
// server/utils/snackbert.ts. Snackbert's function is in another repo
// (christried/snackbert).

export interface SnackbertClient {
  // Whether Snackbert has an account for `email`. Throws when it can't say:
  // a status other than 200, no answer in time, or an answer without
  // `exists`. The error names the status or the error, never the address.
  hasAccount: (email: string) => Promise<boolean>
}

export function createSnackbertClient({ url, secret, timeoutMs = 5000 }: { url: string, secret: string, timeoutMs?: number }): SnackbertClient {
  // A base address without its trailing slash would drop the last segment
  // of its path when resolving 'account-check' against it.
  const endpoint = new URL('account-check', url.endsWith('/') ? url : `${url}/`)
  return {
    async hasAccount(email) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${secret}` },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(timeoutMs),
      }).catch((err: unknown) => {
        throw new Error(`Snackbert is not reachable (${err instanceof Error ? err.name : 'error'})`)
      })
      if (res.status !== 200) throw new Error(`Snackbert answered ${res.status}`)
      const body = await res.json().catch(() => null) as { exists?: unknown } | null
      if (body?.exists === true) return true
      if (body?.exists === false) return false
      throw new Error('Snackbert answered without exists')
    },
  }
}

// The client for the env's Snackbert, or null when it is off (either of the
// two variables empty): then no account is ever asked about.
export function snackbertClientFrom(env: { SNACKBERT_URL: string, SNACKBERT_SECRET: string }): SnackbertClient | null {
  if (env.SNACKBERT_URL === '' || env.SNACKBERT_SECRET === '') return null
  return createSnackbertClient({ url: env.SNACKBERT_URL, secret: env.SNACKBERT_SECRET })
}
