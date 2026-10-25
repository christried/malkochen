import { expect, test } from './fixtures'
import { gotoHydrated } from './hydration'

// The Impressum and the Datenschutz (#391) are pages of malkochen, readable
// signed out, in the app's look. The sign-in screen links to them.

test('signed out, the Impressum opens in malkochen, German', async ({ page }) => {
  await gotoHydrated(page, '/impressum')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impressum')
  await expect(page.getByText('malkochen.christried.me')).toBeVisible()
  await expect(page).toHaveURL('/impressum')
})

test('signed out, the Datenschutz shows German as binding, then English and Italian', async ({ page }) => {
  await gotoHydrated(page, '/datenschutz')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Datenschutzerklärung')
  await expect(page.locator('#de')).toContainText('verbindlich')
  await expect(page.locator('#en')).toBeVisible()
  await expect(page.locator('#it')).toBeVisible()
})

test('the sign-in screen links to the Impressum and the Datenschutz in malkochen', async ({ page }) => {
  await gotoHydrated(page, '/login')

  await expect(page.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum')
  await expect(page.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/datenschutz')
})
