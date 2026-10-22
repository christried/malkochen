import { expect, test } from './fixtures'
import { E2E_ORIGIN, OPERATOR } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { openUserSettings } from './settings-sheet'

// The Admin Page (#348): the Operator finds "Admin" at the end of their
// settings and its figures behind it; anyone else finds neither the link
// nor the page. The Operator switches Open Sign-up there (#350). Babbage is
// the Operator; Church is used by this file only.
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

test('the Operator switches "Anmeldung offen" on, and a stranger\'s sign-up then works', async ({ page, browser }) => {
  const strangerEmail = `stranger-${Date.now().toString(36)}@example.org`
  const visitor = await (await browser.newContext()).newPage()
  const signUp = () => visitor.request.post('/api/auth/dev/sign-in', { data: { email: strangerEmail }, headers: { origin: E2E_ORIGIN } })
  expect((await signUp()).status()).toBe(403)

  await signIn(page, OPERATOR)
  await gotoHydrated(page, '/admin')
  const open = page.getByRole('switch', { name: 'Anmeldung offen' })
  await expect(open).toHaveAttribute('aria-checked', 'false')
  await open.click()
  try {
    await expect(open).toHaveAttribute('aria-checked', 'true')

    expect((await signUp()).status()).toBe(200)
    await gotoHydrated(visitor, '/')
    await expect(visitor).toHaveURL(/\/b\//)

    // Still on after coming back.
    await reloadHydrated(page)
    await expect(open).toHaveAttribute('aria-checked', 'true')
  }
  finally {
    await open.click()
    await expect(open).toHaveAttribute('aria-checked', 'false')
    await visitor.context().close()
  }
})
