import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated } from './hydration'
import { seedDish } from './seed'

// Searching a Board (PRD story 36) on a phone: the magnifier opens a field,
// matches from every Column replace the Columns, and a query that finds
// nothing says so. Mary's Board is used by this file only.

test.describe.configure({ mode: 'serial' })

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
  await expect(results.getByText('Kein Gericht mit „Pizza“ im Namen.')).toBeVisible()

  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).press('Escape')
  await expect(page.getByRole('searchbox')).toBeHidden()
  await expect(column(page, 'Ideen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gerichte suchen' })).toBeFocused()
})

test('the results follow the Board, and ✕ closes the search', async ({ page }) => {
  await signIn(page, ALLOWLISTED[7])
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: 'Gerichte suchen' }).click()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).fill('curry')
  const results = page.getByTestId('search-results')
  await expect(results.getByRole('heading', { level: 3 })).toHaveText(['Rotes Linsen-Curry', 'Thai-Curry'])

  await results.getByRole('link', { name: 'Thai-Curry, Gekocht' }).click()
  const detail = page.getByRole('dialog', { name: 'Thai-Curry' })
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByLabel('Titel').fill('Pad Thai')
  await detail.getByRole('button', { name: 'Speichern' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Schließen' }).click()

  await expect(results.getByRole('heading', { level: 3 })).toHaveText(['Rotes Linsen-Curry'])

  await page.getByRole('button', { name: 'Suche schließen' }).click()
  await expect(page.getByRole('searchbox')).toBeHidden()
  await expect(column(page, 'Ideen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gerichte suchen' })).toBeFocused()
})
