import { expect, test } from '@playwright/test'
import { signIn } from './auth'
import { clipStill } from './clips'
import { gotoHydrated } from './hydration'

// The error screen: for a page that isn't there, and for anything that goes
// wrong unexpectedly, with a way to try again.

test('a Board that doesn\'t exist shows the error screen, with a way back', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/b/00000000-0000-4000-8000-000000000000')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Das gibt’s hier nicht.')
  await expect(clipStill(page, 'error')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nochmal versuchen' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Zu malkochen' }).click()
  await expect(page).toHaveURL(/\/b\/(?!00000000)/)
  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()
})

test('an unexpected error shows the error screen, and "Nochmal versuchen" tries again', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/settings')
  await page.route('**/api/boards/*', route => route.fulfill({ status: 500, body: 'boom' }))

  await page.getByRole('link', { name: 'Zurück zum Board' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Da ist was angebrannt.')
  await expect(page.getByText('Das liegt an uns, nicht an dir.')).toBeVisible()
  await expect(page.getByText('boom')).toHaveCount(0)

  await page.unroute('**/api/boards/*')
  await page.getByRole('button', { name: 'Nochmal versuchen' }).click()
  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()
})
