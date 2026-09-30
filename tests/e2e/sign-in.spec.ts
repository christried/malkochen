import { expect, test } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'

test('a signed-out visitor is sent to the sign-in screen', async ({ page }) => {
  await gotoHydrated(page, '/')

  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible()
})

test('a refused sign-in shows the friendly "Not unlocked" screen', async ({ page }) => {
  await gotoHydrated(page, '/login?error=not_allowed&error_description=Not%20on%20the%20Allowlist')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gleich geht’s los!')
  await expect(page.getByText('Du bist noch nicht für malkochen freigeschaltet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mit einem anderen Konto anmelden' })).toBeVisible()
  await expect(page.getByText('Allowlist')).toHaveCount(0)
})

test('after signing in the app opens "Meine Küche" with its three Columns', async ({ page }) => {
  await signIn(page, ALLOWLISTED[2])
  await gotoHydrated(page, '/')

  await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🍳 Meine Küche')
  const columns = page.getByRole('region')
  await expect(columns.getByRole('heading', { level: 2 })).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
})

test('a signed-in user who opens the sign-in screen lands on their Board instead', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/login')

  await expect(page).toHaveURL(/\/b\//)
})

test('signing out returns to the sign-in screen', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Abmelden' }).click()

  await expect(page).toHaveURL('/login')
  await gotoHydrated(page, '/')
  await expect(page).toHaveURL('/login')
})
