import { expect, test } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated } from './hydration'
import { seedDish } from './seed'

// Searching a Board (PRD story 36) on a phone: the magnifier opens a field,
// matches from every Column replace the Columns, and a query that finds
// nothing says so. Mary's Board is used by this file only.

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

test('finds Dishes from every Column, and says when there are none', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[7])
  await seedDish(page, { title: 'Rotes Linsen-Curry', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedDish(page, { title: 'Shakshuka', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedDish(page, { title: 'Thai-Curry', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 2 })
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gerichte suchen' }).click()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).fill('CURRY')

  const results = page.getByTestId('search-results')
  await expect(results.getByRole('heading', { level: 3 })).toHaveText(['Rotes Linsen-Curry', 'Thai-Curry'])
  await expect(results.getByRole('link', { name: 'Thai-Curry, Gekocht' })).toBeVisible()
  await expect(column(page, 'Ideen')).toBeHidden()

  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).fill('Pizza')
  await expect(results.getByText('Nichts gefunden.')).toBeVisible()

  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).press('Escape')
  await expect(page.getByRole('searchbox')).toBeHidden()
  await expect(column(page, 'Ideen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gerichte suchen' })).toBeFocused()
})
