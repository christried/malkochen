import { expect, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { startResendService, type ResendService } from '../support/resend-service'
import { gotoHydrated } from './hydration'

// Email sign-in with a code (#345): the code comes by email (here to the
// stand-in for Resend, which hands it over), and is typed where sign-in
// started; the email's link signs in wherever it opens. Used by this file
// only.
const PANKHURST = ALLOWLISTED[117]

let resend: ResendService

test.beforeAll(async () => {
  resend = await startResendService()
})

test.afterAll(() => resend.close())

test.beforeEach(() => resend.forget())

function lastEmail() {
  const sent = resend.sent.at(-1)
  if (!sent) throw new Error('no email sent')
  return { code: sent.text.match(/\b\d{6}\b/)![0], link: sent.text.match(/https?:\/\/\S+\/login\?\S+/)![0] }
}

test('a new user signs in with the code from the email, and is asked for a Username', async ({ page }) => {
  await gotoHydrated(page, '/login')

  await page.getByLabel('E-Mail-Adresse').fill(PANKHURST)
  await page.getByRole('button', { name: 'Code per E-Mail schicken' }).click()
  await expect(page.getByText(`Wir haben dir einen Code an ${PANKHURST} geschickt.`)).toBeVisible()
  // Asking for another one takes a short wait.
  await expect(page.getByRole('button', { name: /Neuer Code in \d+ s/ })).toBeDisabled()

  const { code } = lastEmail()
  const wrong = code === '000000' ? '111111' : '000000'
  await page.getByLabel('Code aus der E-Mail').fill(wrong)
  await expect(page.getByRole('alert')).toHaveText('Der Code stimmt nicht. Versuch es noch mal.')

  await page.getByLabel('Code aus der E-Mail').fill(code)

  await expect(page).toHaveURL('/username')
})

test('the link in the email signs in where it opens', async ({ page }) => {
  const asked = await page.request.post('/api/auth/email-otp/send-verification-otp', { data: { email: PANKHURST, type: 'sign-in' }, headers: { origin: E2E_ORIGIN } })
  expect(asked.ok()).toBe(true)

  await page.goto(lastEmail().link)

  // Signed in: on to the Username, as after the code.
  await expect(page).toHaveURL('/username')
})

test('an address not on the Allowlist gets the "Not unlocked" screen, and no email', async ({ page }) => {
  await gotoHydrated(page, '/login')

  await page.getByLabel('E-Mail-Adresse').fill('stranger@example.com')
  await page.getByRole('button', { name: 'Code per E-Mail schicken' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bald geht’s los!')
  expect(resend.sent).toEqual([])

  // Another account: back to the choice of Google or email.
  await page.getByRole('button', { name: 'Mit einem anderen Konto anmelden' }).click()
  await expect(page.getByLabel('E-Mail-Adresse')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible()
})
