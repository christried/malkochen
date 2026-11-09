import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { startSnackbertService, type SnackbertService } from '../support/snackbert-service'
import { signIn } from './auth'
import { openUserSettings } from './settings-sheet'

// Snackbert in your settings (#423): a section only for people with a
// Snackbert account, with its consent and a link to the privacy policy, and
// the switch. The account check, the switch's rules and the Event Log are
// covered by tests/api/snackbert.test.ts. On a computer only: the phone shows
// the same settings in a bottom sheet. These two users are used by this file
// only.
const WITH_ACCOUNT = ALLOWLISTED[176]
const WITHOUT_ACCOUNT = ALLOWLISTED[177]

let snackbert: SnackbertService

test.beforeAll(async () => {
  snackbert = await startSnackbertService()
})

test.afterAll(() => snackbert.close())

test.beforeEach(() => snackbert.forget())

test('a Snackbert account shows the section, with its consent, and the switch stays on after a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  snackbert.accounts.add(WITH_ACCOUNT)
  await signIn(page, WITH_ACCOUNT)

  let sheet = await openUserSettings(page)
  const region = sheet.getByRole('region', { name: 'Snackbert', exact: true })
  await expect(region).toBeVisible()
  await expect(region.getByText('Schaltest du Snackbert ein')).toBeVisible()
  await expect(region.getByRole('link', { name: 'Mehr dazu im Datenschutz' })).toHaveAttribute('href', '/datenschutz')

  const toggle = () => region.getByRole('switch', { name: 'An Snackbert melden' })
  await expect(toggle()).toHaveAttribute('aria-checked', 'false')
  await expect(toggle()).toBeEnabled()
  await toggle().click()
  await expect(toggle()).toHaveAttribute('aria-checked', 'true')

  // After a reload: still on.
  sheet = await openUserSettings(page)
  await expect(sheet.getByRole('region', { name: 'Snackbert', exact: true }).getByRole('switch', { name: 'An Snackbert melden' })).toHaveAttribute('aria-checked', 'true')

  await sheet.getByRole('region', { name: 'Snackbert', exact: true }).getByRole('switch', { name: 'An Snackbert melden' }).click()
  await expect(sheet.getByRole('region', { name: 'Snackbert', exact: true }).getByRole('switch', { name: 'An Snackbert melden' })).toHaveAttribute('aria-checked', 'false')
})

test('without a Snackbert account there is no Snackbert section', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, WITHOUT_ACCOUNT)

  // Wait until Snackbert has been asked, so the section's absence is not just
  // the answer not having come yet.
  const answered = page.waitForResponse(res => res.url().endsWith('/api/me/snackbert') && res.request().method() === 'GET')
  const sheet = await openUserSettings(page)
  await answered
  await expect(sheet.getByRole('region', { name: 'Benachrichtigungen' })).toBeVisible()
  await expect(sheet.getByRole('region', { name: 'Snackbert', exact: true })).toHaveCount(0)
})
