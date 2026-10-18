import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { openUserSettings, settingsSheet } from './settings-sheet'

// Languages (#326): malkochen follows the browser's language ("Automatisch")
// unless the user picks one under Sprache in Your Settings; the pick is kept
// on the user. The rest of the suite runs in a German browser
// (playwright.config.ts). Hopper, Bartik and Payne are used by this file
// only.
const HOPPER = ALLOWLISTED[75]
const BARTIK = ALLOWLISTED[76]
const PAYNE = ALLOWLISTED[77]

test.describe('with an English browser', () => {
  test.use({ locale: 'en-GB' })

  test('the sign-in screen arrives in English, before any script has run', async ({ browser }) => {
    // The server's render alone: no script to switch anything afterwards.
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'en-GB', javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto('/login')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What’s cooking on malkochen?')
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await context.close()
  })

  test('with "Automatisch", the Board is in English too', async ({ page }) => {
    await signIn(page, HOPPER)
    await gotoHydrated(page, '/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('button', { name: 'Add dish' })).toBeVisible()
  })
})

test.describe('with an Italian browser', () => {
  test.use({ locale: 'it-CH' })

  test('with "Automatisch", the Board is in Italian (#327)', async ({ page }) => {
    await signIn(page, HOPPER)
    await gotoHydrated(page, '/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'it')
    await expect(page.getByRole('button', { name: 'Aggiungi un piatto' })).toBeVisible()
  })
})

test('a German browser gets the sign-in screen in German', async ({ page }) => {
  await gotoHydrated(page, '/login')

  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible()
})

test('picking English in Your Settings changes the Board at once, without a reload, and it holds after signing in again', async ({ page }) => {
  await signIn(page, BARTIK)
  const sheet = await openUserSettings(page)
  const language = sheet.getByRole('radiogroup', { name: 'Sprache' })
  await expect(language.getByRole('radio')).toHaveText(['Automatisch', 'Deutsch', 'English', 'Italiano'])
  await expect(language.getByRole('radio', { name: 'Automatisch' })).toHaveAttribute('aria-checked', 'true')
  // Gone if the page loads again.
  await page.evaluate(() => ((window as { stayed?: boolean }).stayed = true))

  await language.getByRole('radio', { name: 'English' }).click()

  // The sheet and the Board under it, at once.
  const english = page.getByRole('dialog', { name: 'Settings', exact: true })
  await expect(english.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
  await expect(english.getByRole('heading', { name: 'Appearance' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await english.getByRole('button', { name: 'Close settings' }).click()
  await expect(page.getByRole('button', { name: 'Add dish' })).toBeVisible()
  expect(await page.evaluate(() => (window as { stayed?: boolean }).stayed)).toBe(true)

  // Kept on the user: signed out, the browser's German counts again; signed
  // in again, English.
  await (await openUserSettings(page, 'Settings')).getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible()
  await signIn(page, BARTIK)
  await gotoHydrated(page, '/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Add dish' })).toBeVisible()

  // And back to "Automatisch": German, as the browser is.
  const back = await openUserSettings(page, 'Settings')
  await back.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'Automatic' }).click()
  await expect(settingsSheet(page).getByRole('radiogroup', { name: 'Sprache' }).getByRole('radio', { name: 'Automatisch' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})

test('picking Italiano in Your Settings shows the Board in Italian at once, and the next visit too (#327)', async ({ page }) => {
  await signIn(page, PAYNE)
  const sheet = await openUserSettings(page)

  await sheet.getByRole('radiogroup', { name: 'Sprache' }).getByRole('radio', { name: 'Italiano' }).click()

  const italian = settingsSheet(page, 'Impostazioni')
  await expect(italian.getByRole('radiogroup', { name: 'Lingua' }).getByRole('radio', { name: 'Italiano' })).toHaveAttribute('aria-checked', 'true')
  await expect(italian.getByRole('heading', { name: 'Aspetto' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'it')
  await italian.getByRole('button', { name: 'Chiudi le impostazioni' }).click()
  await expect(page.getByRole('button', { name: 'Aggiungi un piatto' })).toBeVisible()

  // Kept on the user: the next visit is in Italian from the server's render.
  await gotoHydrated(page, '/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'it')
  await expect(page.getByRole('button', { name: 'Aggiungi un piatto' })).toBeVisible()
})
