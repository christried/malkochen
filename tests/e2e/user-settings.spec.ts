import { expect, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'

// User settings (PRD stories 73–75): your Google name and photo, Darstellung
// and signing out. Jean is used by this file only.
const JEAN = ALLOWLISTED[18]
// Stands in for Google's photo URL; served by the app, so it loads offline.
const PHOTO = `${E2E_ORIGIN}/icons/icon-192.png`

// Handoff tokens.css: light --color-bg #F7F6F2, dark #131211.
const LIGHT_BG = 'rgb(247, 246, 242)'
const DARK_BG = 'rgb(19, 18, 17)'

test.use({ colorScheme: 'light' })

test.beforeEach(async ({ page }) => {
  await signIn(page, JEAN, { name: 'Jean Bartik', image: PHOTO })
})

test('your photo on the Board opens your settings, with your Google name and photo', async ({ page }) => {
  await gotoHydrated(page, '/')
  const board = page.url()

  await page.getByRole('link', { name: 'Deine Einstellungen' }).click()

  await expect(page).toHaveURL('/settings')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen')
  const account = page.getByRole('region', { name: 'Konto' })
  await expect(account.getByText('Jean Bartik')).toBeVisible()
  await expect(account.getByText(JEAN)).toBeVisible()
  await expect(account.locator(`img[src="${PHOTO}"]`)).toBeVisible()
  // German only for now: the language setting has its place but no choice yet.
  await expect(page.getByRole('region', { name: 'Sprache' }).getByText('Deutsch')).toBeVisible()

  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(page).toHaveURL(board)
})

test('on a phone your settings are the last row of the Board switcher', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/')
  // No room in the header beside the Board's name.
  await expect(page.getByRole('link', { name: 'Deine Einstellungen' })).toHaveCount(0)

  await page.getByRole('button', { name: /Board wechseln/ }).click()
  const panel = page.getByRole('navigation')
  await expect(panel.getByRole('listitem').last()).toContainText('Deine Einstellungen')
  await panel.getByRole('link', { name: 'Deine Einstellungen' }).click()

  await expect(page).toHaveURL('/settings')
})

test('Darstellung switches between light and dark at once, and the choice survives a reload', async ({ page }) => {
  await gotoHydrated(page, '/settings')
  const main = page.getByRole('main')
  await expect(main).toHaveCSS('background-color', LIGHT_BG)

  await page.getByRole('radio', { name: 'Dunkel' }).click()
  await expect(page.getByRole('radio', { name: 'Dunkel' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(main).toHaveCSS('background-color', DARK_BG)

  await reloadHydrated(page)
  await expect(main).toHaveCSS('background-color', DARK_BG)
  await gotoHydrated(page, '/')
  await expect(page.getByRole('main')).toHaveCSS('background-color', DARK_BG)

  await gotoHydrated(page, '/settings')
  await page.getByRole('radio', { name: 'Hell' }).click()
  await expect(page.getByRole('main')).toHaveCSS('background-color', LIGHT_BG)
})

test('"System" follows the device colour scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await gotoHydrated(page, '/settings')

  await page.getByRole('radio', { name: 'System' }).click()

  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  await expect(page.getByRole('main')).toHaveCSS('background-color', DARK_BG)
})

test('"Abmelden" ends the session and returns to the sign-in screen', async ({ page }) => {
  await gotoHydrated(page, '/settings')

  await page.getByRole('button', { name: 'Abmelden' }).click()

  await expect(page).toHaveURL('/login')
  expect((await page.request.get('/api/me')).status()).toBe(401)
  await gotoHydrated(page, '/settings')
  await expect(page).toHaveURL('/login')
})
