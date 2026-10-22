import { readFileSync } from 'node:fs'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { TEST_VERSION } from '../support/test-version'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { openUserSettings } from './settings-sheet'

// The Changelog (CONTEXT.md, #354): "Was ist neu", readable without signing
// in and linked from the sign-in screen; at the end of Your Settings, marked
// "Neu" until the app's Version (TEST_VERSION here) has been opened there.
// Babbage is used by this file only.
const BABBAGE = ALLOWLISTED[130]

// The newest Version, which the page reads from the files (package.json's
// matches it: tests/client/changelog.test.ts).
const { version: NEWEST } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

test('signed out, the sign-in screen links to the Changelog, which opens without signing in', async ({ page }) => {
  await gotoHydrated(page, '/login')

  await page.getByRole('link', { name: 'Was ist neu' }).click()

  await expect(page).toHaveURL('/changelog')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was ist neu')
  // The newest Version, its sections in German.
  await expect(page.getByRole('heading', { level: 2, name: `Version ${NEWEST}` })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hinzugefügt' }).first()).toBeVisible()

  await reloadHydrated(page)
  await expect(page).toHaveURL('/changelog')
})

test('"Was ist neu" ends Your Settings with the Version, marked "Neu" until the Changelog has been opened', async ({ page }) => {
  await signIn(page, BABBAGE, { name: 'Charles Babbage' })

  const sheet = await openUserSettings(page)
  const link = sheet.getByRole('link', { name: /^Was ist neu/ })
  await expect(link.getByText('Neu', { exact: true })).toBeVisible()
  await expect(link).toContainText(`Du nutzt malkochen ${TEST_VERSION}.`)
  await link.click()

  await expect(page).toHaveURL('/changelog')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was ist neu')
  await expect.poll(async () => (await (await page.request.get('/api/me')).json() as { newVersion: boolean }).newVersion).toBe(false)

  // Gone from Your Settings, for good.
  const again = await openUserSettings(page)
  const linkAgain = again.getByRole('link', { name: /^Was ist neu/ })
  await expect(linkAgain).toContainText(`Du nutzt malkochen ${TEST_VERSION}.`)
  await expect(linkAgain.getByText('Neu', { exact: true })).toHaveCount(0)
})
