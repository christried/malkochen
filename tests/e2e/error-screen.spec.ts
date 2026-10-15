import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'

// The error screen: for a page that isn't there, and for anything that goes
// wrong unexpectedly, with a way to try again.

test('a Board that doesn\'t exist shows the error screen, with a way back', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/b/00000000-0000-4000-8000-000000000000')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Das gibt’s hier nicht.')
  await expect(page.locator('[data-svg-loop][data-clip="/clips/error"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nochmal versuchen' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Zu malkochen' }).click()
  await expect(page).toHaveURL(/\/b\/(?!00000000)/)
  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()
})

// The Board fails to load, unexpectedly: the error screen shows.
async function failBoardLoad(page: Page) {
  await signIn(page)
  await gotoHydrated(page, '/')
  await gotoHydrated(page, `${page.url()}/settings`)
  await page.route('**/api/boards/*', route => route.fulfill({ status: 500, body: 'boom' }))

  await page.getByRole('link', { name: 'Zurück zum Board' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Da ist was angebrannt.')
}

test('an unexpected error shows the error screen, and "Nochmal versuchen" tries again', async ({ page }) => {
  await failBoardLoad(page)
  await expect(page.getByText('Das liegt an uns, nicht an dir.')).toBeVisible()
  await expect(page.getByText('boom')).toHaveCount(0)

  await page.unroute('**/api/boards/*')
  await page.getByRole('button', { name: 'Nochmal versuchen' }).click()
  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()
})

// Nuxt 4.6's dev error overlay would show that error on every page open on
// the dev server; the browser tests leave it out (nuxt.config.ts, #243).
test('an unexpected error stays on its own page: the next page shows no dev error overlay', async ({ page, context }) => {
  await failBoardLoad(page)

  const nextPage = await context.newPage()
  await gotoHydrated(nextPage, '/')
  await expect(nextPage.getByRole('region', { name: 'Ideen' })).toBeVisible()
  // The overlay would come a moment after hydration: the page asks the dev
  // server for the current error, then fetches and mounts the overlay.
  await nextPage.waitForTimeout(2000)
  await expect(nextPage.locator('[data-nuxt-dev-error], nuxt-error-overlay')).toHaveCount(0)
  await expect(nextPage.getByRole('heading', { level: 1 })).toHaveCount(1)
  await expect(nextPage.getByRole('main')).toHaveCount(1)
})
