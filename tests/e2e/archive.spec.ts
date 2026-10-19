import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { openBoardSettings } from './board'
import { gotoHydrated } from './hydration'
import { removeUsers, seedDish } from './seed'

// Archived Dishes (#336; CONTEXT.md: Archived Dish): a Dish archived from
// its menu waits in the Archiv in Board Settings, with who archived it and
// the days it has left, and comes back to its place from there. The Owner
// can delete one for good. Elion's Board is used by this file only.
test.describe.configure({ mode: 'serial' })
test.beforeAll(() => removeUsers(ALLOWLISTED[51]))

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// The titles of the Dishes in Ideen, top to bottom.
function ideen(page: Page) {
  return page.getByRole('region', { name: 'Ideen' }).getByRole('heading', { level: 3 })
}

function archive(page: Page) {
  return page.getByRole('list', { name: 'Archiv' })
}

async function archiveFromMenu(page: Page, title: string) {
  await page.getByRole('button', { name: `Mehr zu „${title}“` }).click()
  await page.getByRole('dialog', { name: title }).getByRole('button', { name: 'Archivieren' }).click()
  await expect(page.getByRole('status').filter({ hasText: `„${title}“ archiviert` })).toBeVisible()
}

test('an archived Dish is in the Archiv and is restored from there, back in its place', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[51])
  for (const title of ['Linsensuppe', 'Chana Masala', 'Pad Thai']) {
    await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  }
  await gotoHydrated(page, '/')
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Chana Masala', 'Linsensuppe'])

  await archiveFromMenu(page, 'Chana Masala')
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Linsensuppe'])

  await openBoardSettings(page)
  const archived = archive(page).getByRole('listitem')
  await expect(archived).toHaveCount(1)
  await expect(archived).toContainText('Chana Masala')
  await expect(archived).toContainText(/^Chana MasalaVon \S+ am .+ archiviertNoch 30 Tage/)

  await archived.getByRole('button', { name: '„Chana Masala“ wiederherstellen' }).click()

  await expect(page.getByRole('status').filter({ hasText: '„Chana Masala“ ist wieder auf dem Board.' })).toBeVisible()
  await expect(page.getByText('Gerade ist nichts archiviert.')).toBeVisible()
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(ideen(page)).toHaveText(['Pad Thai', 'Chana Masala', 'Linsensuppe'])
})

test('the Owner deletes an archived Dish for good, after confirming', async ({ page }) => {
  await signIn(page, ALLOWLISTED[51])
  await gotoHydrated(page, '/')
  await archiveFromMenu(page, 'Linsensuppe')
  await openBoardSettings(page)
  const archived = archive(page).getByRole('listitem')
  await expect(archived).toContainText('Linsensuppe')

  await archived.getByRole('button', { name: '„Linsensuppe“ endgültig löschen' }).click()
  const confirm = page.getByRole('dialog', { name: '„Linsensuppe“ endgültig löschen?' })
  await confirm.getByRole('button', { name: 'Endgültig löschen' }).click()

  await expect(page.getByRole('status').filter({ hasText: '„Linsensuppe“ ist endgültig gelöscht.' })).toBeVisible()
  await expect(page.getByText('Gerade ist nichts archiviert.')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Gerade ist nichts archiviert.')).toBeVisible()
})
