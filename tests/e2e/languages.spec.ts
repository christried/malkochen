import type { Locator } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { inviteToken } from './invite'
import { landingBoardId } from './seed'
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

  test('the invite landing is in English for a visitor whose browser is (#328)', async ({ page, browser }) => {
    await signIn(page, HOPPER)
    const token = await inviteToken(page, await landingBoardId(page))
    const visitor = await newTab(browser, { locale: 'en-GB' })

    await gotoHydrated(visitor, `/invite/${token}`)

    await expect(visitor.locator('html')).toHaveAttribute('lang', 'en')
    await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(/^You’re invited to /)
    await expect(visitor.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await visitor.context().close()
  })

  test.describe('offline', () => {
    // The service worker serves the Offline page (offline.spec.ts).
    test.use({ serviceWorkers: 'allow' })

    test('the Offline page is in English, from the device\'s language (#328)', async ({ page, context }) => {
      await signIn(page, HOPPER)
      await gotoHydrated(page, '/')
      await page.evaluate(() => navigator.serviceWorker.ready)
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

      await context.setOffline(true)
      await page.goto('/')

      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('You’re offline.')
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
      await expect(page).toHaveTitle('Offline · malkochen')
      await context.setOffline(false)
    })
  })
})

test.describe('with an Italian browser', () => {
  test.use({ locale: 'it-CH' })

  test('with "Automatisch", the Board is in Italian (#327)', async ({ page }) => {
    await signIn(page, HOPPER)
    await gotoHydrated(page, '/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'it')
    await expect(page.getByRole('button', { name: 'Aggiungi un piatto' })).toBeVisible()
    // Still "Automatisch", in its Italian name.
    const sheet = await openUserSettings(page, 'Impostazioni')
    await expect(sheet.getByRole('radiogroup', { name: 'Lingua' }).getByRole('radio', { name: 'Automatica' })).toHaveAttribute('aria-checked', 'true')
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

// Each choice's label against its button, and the highlight (the picker's
// thumb) against the chosen one, in whole pixels.
async function pickerLayout(group: Locator) {
  return group.evaluate((el) => {
    const thumb = el.querySelector(':scope > [aria-hidden="true"]')!.getBoundingClientRect()
    const chosen = el.querySelector('[aria-checked="true"]')!.getBoundingClientRect()
    return {
      cutOff: [...el.querySelectorAll('[role="radio"]')].filter(radio => radio.scrollWidth > radio.clientWidth).map(radio => radio.textContent!.trim()),
      thumb: [thumb.left, thumb.width].map(Math.round),
      chosen: [chosen.left, chosen.width].map(Math.round),
    }
  })
}

test('on a 360px phone, all four choices fit, in German and Italian, and the highlight sits under the chosen one (#327)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await signIn(page, PAYNE)
  // Whatever the test before left: Automatisch, in this German browser.
  await page.request.put('/api/me/language', { data: { language: 'auto' }, headers: { origin: E2E_ORIGIN } })
  const sheet = await openUserSettings(page)
  const german = sheet.getByRole('radiogroup', { name: 'Sprache' })
  await expect(german.getByRole('radio', { name: 'Automatisch' })).toHaveAttribute('aria-checked', 'true')

  await expect.poll(() => pickerLayout(german)).toEqual(expect.objectContaining({ cutOff: [] }))
  let layout = await pickerLayout(german)
  expect(layout.thumb).toEqual(layout.chosen)

  await german.getByRole('radio', { name: 'Italiano' }).click()
  const italian = settingsSheet(page, 'Impostazioni').getByRole('radiogroup', { name: 'Lingua' })
  await expect(italian.getByRole('radio', { name: 'Italiano' })).toHaveAttribute('aria-checked', 'true')

  // Once the highlight has slid over.
  await expect.poll(async () => {
    const { thumb, chosen } = await pickerLayout(italian)
    return thumb.join() === chosen.join()
  }).toBe(true)
  layout = await pickerLayout(italian)
  expect(layout.cutOff).toEqual([])
})
