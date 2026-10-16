import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { openUserSettings } from './settings-sheet'

// The Email Digest in your settings (#220): one switch for all your Boards
// and devices, off until you switch it on. What the email lists, and for
// whom, is covered by tests/api/email-digest.test.ts. On a computer only:
// the phone shows the same settings in a bottom sheet. Goldberg is used by
// this file only.
const GOLDBERG = ALLOWLISTED[65]

test('the daily email is off until switched on, and stays on after a reload and on another device', async ({ page, browser }) => {
  const viewport = { width: 1280, height: 900 }
  await page.setViewportSize(viewport)
  await signIn(page, GOLDBERG)

  let sheet = await openUserSettings(page)
  const toggle = () => sheet.getByRole('region', { name: 'Benachrichtigungen' }).getByRole('switch', { name: 'Tägliche E-Mail' })
  await expect(toggle()).toHaveAttribute('aria-checked', 'false')
  await expect(toggle()).toBeEnabled()

  await toggle().click()
  await expect(toggle()).toHaveAttribute('aria-checked', 'true')

  // After a reload: still on.
  sheet = await openUserSettings(page)
  await expect(toggle()).toHaveAttribute('aria-checked', 'true')

  // On another device: on there too, and switched off there, off here.
  const other = await newTab(browser, { viewport })
  await signIn(other, GOLDBERG)
  const otherSheet = await openUserSettings(other)
  const otherToggle = otherSheet.getByRole('switch', { name: 'Tägliche E-Mail' })
  await expect(otherToggle).toHaveAttribute('aria-checked', 'true')
  await otherToggle.click()
  await expect(otherToggle).toHaveAttribute('aria-checked', 'false')
  await other.context().close()

  sheet = await openUserSettings(page)
  await expect(toggle()).toHaveAttribute('aria-checked', 'false')
})
