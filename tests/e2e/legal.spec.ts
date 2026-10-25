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

test('signed out, the Datenschutz opens in German: its heading, the binding note, and German marked as the current language', async ({ page }) => {
  await gotoHydrated(page, '/datenschutz')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Datenschutzerklärung')
  await expect(page.getByText('Verbindliche Fassung')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Deutsch' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Privacy policy')).toHaveCount(0)
})

test('?lang=en opens the English Datenschutz, and its link leads back to the German one', async ({ page }) => {
  await gotoHydrated(page, '/datenschutz?lang=en')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy')
  await expect(page.locator('article')).toHaveAttribute('lang', 'en')
  await page.getByRole('link', { name: 'Zur verbindlichen deutschen Fassung' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Datenschutzerklärung')
  await expect(page).toHaveURL(/\?lang=de$/)
})

test('the Datenschutz switches to the Italian text from the language switcher', async ({ page }) => {
  await gotoHydrated(page, '/datenschutz')

  await page.getByRole('link', { name: 'Italiano' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Informativa sulla privacy')
})

test('the sign-in screen links to the Impressum and the Datenschutz in malkochen', async ({ page }) => {
  await gotoHydrated(page, '/login')

  await expect(page.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum')
  await expect(page.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/datenschutz')
})
