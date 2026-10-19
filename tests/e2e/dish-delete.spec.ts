import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeUsers, seedDish } from './seed'

// Archiving a Dish with undo (PRD story 47, #336), from the card's "…" menu
// and from the Dish detail; the Archive itself is archive.spec.ts. Margaret's Board is used by this file only.
test.describe.configure({ mode: 'serial' })
test.beforeAll(() => removeUsers(ALLOWLISTED[3]))

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// The titles of the Dishes in Ideen, top to bottom.
function ideen(page: Page) {
  return page.getByRole('region', { name: 'Ideen' }).getByRole('heading', { level: 3 })
}

test('archiving from the card’s menu can be undone, back in the same place', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[3])
  for (const title of ['Linsensuppe', 'Chana Masala', 'Pad Thai']) {
    await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  }
  await gotoHydrated(page, '/')
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Chana Masala', 'Linsensuppe'])

  await page.getByRole('button', { name: 'Mehr zu „Chana Masala“' }).click()
  const menu = page.getByRole('dialog', { name: 'Chana Masala' })
  await menu.getByRole('button', { name: 'Archivieren' }).click()

  await expect(menu).toBeHidden()
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Linsensuppe'])
  const toast = page.getByRole('status').filter({ hasText: '„Chana Masala“ archiviert' })
  await expect(toast).toBeVisible()

  await toast.getByRole('button', { name: 'Rückgängig' }).click()

  await expect(ideen(page)).toHaveText(['Pad Thai', 'Chana Masala', 'Linsensuppe'])
  await expect(toast).toBeHidden()
  await reloadHydrated(page)
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Chana Masala', 'Linsensuppe'])
})

test('archiving from the detail closes it; without undo the Dish stays off the Board', async ({ page }) => {
  await signIn(page, ALLOWLISTED[3])
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Linsensuppe' }).click()
  const detail = page.getByRole('dialog', { name: 'Linsensuppe' })

  await detail.getByRole('button', { name: 'Archivieren' }).click()

  await expect(detail).toBeHidden()
  await expect(page).toHaveURL(/\/b\/[^/]+$/)
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Chana Masala'])
  const toast = page.getByRole('status').filter({ hasText: '„Linsensuppe“ archiviert' })
  await expect(toast.getByRole('button', { name: 'Rückgängig' })).toBeVisible()

  // The undo window is 5 seconds.
  await expect(toast).toBeHidden({ timeout: 8000 })
  await reloadHydrated(page)
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Chana Masala'])
})

test('undo finds the Dish’s place even after a Dish was added meanwhile; focus follows', async ({ page }) => {
  await signIn(page, ALLOWLISTED[3])
  await gotoHydrated(page, '/')
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Chana Masala'])

  await page.getByRole('button', { name: 'Mehr zu „Chana Masala“' }).click()
  await page.getByRole('dialog', { name: 'Chana Masala' }).getByRole('button', { name: 'Archivieren' }).click()
  // The card in its place (here: the one above it) takes focus.
  await expect(page.getByRole('link', { name: 'Pad Thai' })).toBeFocused()

  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await page.getByRole('dialog', { name: 'Gericht hinzufügen' }).getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
  await sheet.getByLabel('Titel').fill('Tacos')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(ideen(page)).toHaveText(['Tacos', 'Pad Thai'])

  await page.getByRole('status').getByRole('button', { name: 'Rückgängig' }).click()

  await expect(ideen(page)).toHaveText(['Tacos', 'Pad Thai', 'Chana Masala'])
  await expect(page.getByRole('link', { name: 'Chana Masala' })).toBeFocused()
  await reloadHydrated(page)
  await expect(ideen(page)).toHaveText(['Tacos', 'Pad Thai', 'Chana Masala'])
})

test('archiving a Column’s last Dish puts focus on the Column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page, ALLOWLISTED[3])
  await seedDish(page, { title: 'Ramen', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Mehr zu „Ramen“' }).click()
  await page.getByRole('dialog', { name: 'Ramen' }).getByRole('button', { name: 'Archivieren' }).click()

  const dieseWoche = page.getByRole('region', { name: 'Diese Woche' })
  await expect(dieseWoche).toBeFocused()
  await expect(dieseWoche.getByText('Noch nichts hier.')).toBeVisible()
})

test('a failed archiving puts the card back and says so; one already archived just goes', async ({ page }) => {
  await signIn(page, ALLOWLISTED[3])
  await gotoHydrated(page, '/')
  const answer = { status: 500 }
  await page.route('**/api/dishes/*', route => route.request().method() === 'DELETE' ? route.fulfill(answer) : route.fallback())

  await page.getByRole('button', { name: 'Mehr zu „Tacos“' }).click()
  await page.getByRole('dialog', { name: 'Tacos' }).getByRole('button', { name: 'Archivieren' }).click()

  await expect(page.locator('[data-toast]')).toHaveText('„Tacos“ ließ sich nicht archivieren. Versuch es gleich noch mal.')
  await expect(ideen(page)).toHaveText(['Tacos', 'Pad Thai', 'Chana Masala'])

  // Another Member archived it first: the server doesn't find it any more.
  answer.status = 404
  await page.getByRole('button', { name: 'Mehr zu „Tacos“' }).click()
  await page.getByRole('dialog', { name: 'Tacos' }).getByRole('button', { name: 'Archivieren' }).click()

  await expect(page.locator('[data-toast]')).toContainText('„Tacos“ archiviert')
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Chana Masala'])
})
