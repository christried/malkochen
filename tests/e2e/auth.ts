import type { Page } from '@playwright/test'
import { E2E_ORIGIN } from '../support/test-auth-env'

// Signs the browser in through the dev bypass (tests/support/test-auth-env.ts
// turns it on). page.request shares the page's cookies, so the session cookie
// lands in the browser like after a Google sign-in. The Origin header is what
// a browser sends; Better Auth refuses cookie-carrying POSTs without it.
export async function signIn(page: Page, email = 'ada@example.com') {
  const res = await page.request.post('/api/auth/dev/sign-in', { data: { email }, headers: { origin: E2E_ORIGIN } })
  if (!res.ok()) throw new Error(`sign-in as ${email} failed: ${res.status()} ${await res.text()}`)
}
