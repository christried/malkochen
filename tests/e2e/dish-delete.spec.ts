import { expect, test, type Page } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { seedDish } from './seed'

// Deleting a Dish with undo (PRD story 47), from the card's "…" menu and from
// the Dish detail. Margaret's Board is used by this file only.
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// The titles of the Dishes in Ideen, top to bottom.
function ideen(page: Page) {
  return page.getByRole('region', { name: 'Ideen' }).getByRole('heading', { level: 3 })
}

test('deleting from the card’s menu can be undone, back in the same place', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[3])
  for (const title of ['Linsensuppe', 'Shakshuka', 'Pad Thai']) {
    await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  }
  await gotoHydrated(page, '/')
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Shakshuka', 'Linsensuppe'])

  await page.getByRole('button', { name: 'Mehr zu „Shakshuka“' }).click()
  const menu = page.getByRole('dialog', { name: 'Shakshuka' })
  await menu.getByRole('button', { name: 'Löschen' }).click()

  await expect(menu).toBeHidden()
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Linsensuppe'])
  const toast = page.getByRole('status').filter({ hasText: '„Shakshuka“ gelöscht' })
  await expect(toast).toBeVisible()

  await toast.getByRole('button', { name: 'Rückgängig' }).click()

  await expect(ideen(page)).toHaveText(['Pad Thai', 'Shakshuka', 'Linsensuppe'])
  await expect(toast).toBeHidden()
  await reloadHydrated(page)
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Shakshuka', 'Linsensuppe'])
})

test('deleting from the detail closes it; without undo the Dish stays gone', async ({ page }) => {
  await signIn(page, ALLOWLISTED[3])
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Linsensuppe' }).click()
  const detail = page.getByRole('dialog', { name: 'Linsensuppe' })

  await detail.getByRole('button', { name: 'Löschen' }).click()

  await expect(detail).toBeHidden()
  await expect(page).toHaveURL(/\/b\/[^/]+$/)
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Shakshuka'])
  const toast = page.getByRole('status').filter({ hasText: '„Linsensuppe“ gelöscht' })
  await expect(toast.getByRole('button', { name: 'Rückgängig' })).toBeVisible()

  // The undo window is 5 seconds.
  await expect(toast).toBeHidden({ timeout: 8000 })
  await reloadHydrated(page)
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Shakshuka'])
})
