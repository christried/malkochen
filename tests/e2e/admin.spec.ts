import { expect, test } from './fixtures'
import { OPERATOR } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { openUserSettings } from './settings-sheet'

// The Admin Page (#348): the Operator finds "Admin" at the end of their
// settings and its figures behind it; anyone else finds neither the link
// nor the page. Babbage is the Operator; Church is used by this file only.
const CHURCH = 'church@example.com'

test('the Operator opens the Admin Page from the end of their settings', async ({ page }) => {
  await signIn(page, OPERATOR)
  const sheet = await openUserSettings(page)

  await sheet.getByRole('link', { name: /^Admin/ }).click()

  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('heading', { name: 'Admin', level: 1 })).toBeVisible()
  for (const heading of ['Kostenlose Grenzen', 'Aktiv', 'Neue Gerichte nach Quelle', 'Was auf den Boards passiert', 'Neu angemeldet']) {
    await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible()
  }
  await expect(page.getByRole('row', { name: /^Datenbank \(Neon\)/ })).toBeVisible()
})

test('anyone else has no Admin link, and the Admin Page isn\'t there for them', async ({ page }) => {
  await signIn(page, CHURCH)
  const sheet = await openUserSettings(page)

  await expect(sheet.getByRole('region', { name: 'Konto löschen' })).toBeVisible()
  await expect(sheet.getByRole('link', { name: /^Admin/ })).toHaveCount(0)

  await gotoHydrated(page, '/admin')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Das gibt’s hier nicht.')
})
