import { expect, test, type Page } from '@playwright/test'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'

// The Offline screen (PRD story 8). Opening malkochen without a connection
// gets the service worker's Offline page; losing the connection with the app
// open shows the Offline screen over it until the connection is back.

// The service worker is what serves the Offline page (blocked elsewhere,
// playwright.config.ts).
test.use({ serviceWorkers: 'allow' })

async function serviceWorkerInControl(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  // A first visit isn't controlled until the worker claims it.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
}

test('opening malkochen offline shows the Offline page, which carries on once back online', async ({ page, context }) => {
  await signIn(page)
  await gotoHydrated(page, '/')
  await serviceWorkerInControl(page)

  await context.setOffline(true)
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Du bist offline.')
  await expect(page.locator('img[src="/illustrations/topfbert-sleep.svg"]')).toBeVisible()

  await expect(page.getByRole('button', { name: 'Nochmal versuchen' })).toBeVisible()

  // No need to press it: the page reloads itself when the connection is back.
  await context.setOffline(false)
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Du bist offline.')
})

test('losing the connection with the app open shows the Offline screen until it is back', async ({ page, context }) => {
  await signIn(page)
  await gotoHydrated(page, '/')
  const offline = page.getByRole('alertdialog', { name: 'Du bist offline.' })
  await expect(offline).toHaveCount(0)

  await context.setOffline(true)
  await expect(offline).toBeVisible()
  await expect(offline.locator('img[src="/illustrations/topfbert-sleep.svg"]')).toBeVisible()
  // The app underneath is out of reach until the connection is back.
  await expect(offline.getByRole('button', { name: 'Nochmal versuchen' })).toBeFocused()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.closest('main') ?? null)).toBeNull()

  await context.setOffline(false)
  await expect(offline).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()
})
