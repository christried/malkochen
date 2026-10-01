import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { resetBoard, seedDish } from './seed'

// Board settings (PRD stories 57–60, 62): the Board's name and emoji, and
// its Columns. Ida's Board is used by this file only; each test starts it
// afresh, as a new Board.

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// The Column names in settings, top to bottom, until they are `expected`.
async function expectColumnNames(page: Page, expected: string[]) {
  const fields = page.getByRole('list', { name: 'Spalten' }).getByRole('textbox')
  await expect.poll(() => fields.evaluateAll(els => els.map(el => (el as HTMLInputElement).value))).toEqual(expected)
}

function row(page: Page, name: string) {
  return page.getByRole('listitem').filter({ has: page.getByRole('textbox', { name: `Name der Spalte „${name}“` }) })
}

// Signs in as Ida with a fresh Board, `before` it is shown (e.g. to seed
// Dishes), and opens its settings from the Board.
async function openSettings(page: Page, before?: () => Promise<void>) {
  await signIn(page, ALLOWLISTED[8])
  await resetBoard(page)
  await before?.()
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Board-Einstellungen' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Board-Einstellungen' })).toBeVisible()
  // Its own page: nothing of the Board behind it.
  await expect(page.getByRole('button', { name: 'Gericht hinzufügen' })).toHaveCount(0)
}

test('a Member renames the Board and picks another emoji', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSettings(page)

  const name = page.getByLabel('Name', { exact: true })
  await name.fill('Kochclub')
  await name.press('Enter')
  await page.getByRole('button', { name: 'Emoji ändern' }).click()
  await page.getByRole('dialog', { name: 'Emoji wählen' }).getByRole('radio', { name: '🍜' }).click()

  await expect(page.getByRole('button', { name: 'Emoji ändern' })).toHaveText('🍜')
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🍜 Kochclub')
  await reloadHydrated(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🍜 Kochclub')
})

test('a Member adds, renames and reorders Columns; Gekocht is marked and can’t be deleted', async ({ page }) => {
  await openSettings(page)
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht'])
  await expect(row(page, 'Gekocht')).toContainText('Kann nicht gelöscht werden')
  await expect(page.getByRole('button', { name: 'Spalte „Gekocht“ löschen' })).toHaveCount(0)

  await page.getByLabel('Neue Spalte').fill('Wochenende')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht', 'Wochenende'])

  const renamed = page.getByRole('textbox', { name: 'Name der Spalte „Wochenende“' })
  await renamed.fill('Für Gäste')
  await renamed.press('Enter')
  await page.getByRole('button', { name: '„Für Gäste“ nach oben' }).click()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Für Gäste', 'Gekocht'])

  await reloadHydrated(page)
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Für Gäste', 'Gekocht'])
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(page.getByRole('region').getByRole('heading', { level: 2 })).toHaveText(['Ideen', 'Diese Woche', 'Für Gäste', 'Gekocht'])
})

test('an empty Column goes at once', async ({ page }) => {
  await openSettings(page)

  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()

  await expectColumnNames(page, ['Ideen', 'Gekocht'])
  // The last Column besides Gekocht stays.
  await expect(page.getByRole('button', { name: 'Spalte „Ideen“ löschen' })).toBeDisabled()
  await reloadHydrated(page)
  await expectColumnNames(page, ['Ideen', 'Gekocht'])
})

test('a Column with Dishes asks where they go, and they go there', async ({ page }) => {
  await openSettings(page, async () => {
    for (const title of ['Ramen', 'Bibimbap']) await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  })

  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()
  const dialog = page.getByRole('dialog', { name: '2 Gerichte in „Diese Woche“. Wohin verschieben?' })
  await expect(dialog.getByRole('radio', { name: 'Ideen' })).toBeChecked()
  await dialog.getByRole('radio', { name: 'Gekocht' }).check()
  await dialog.getByRole('button', { name: 'Verschieben und löschen' }).click()

  await expect(dialog).toBeHidden()
  await expectColumnNames(page, ['Ideen', 'Gekocht'])
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(column(page, 'Gekocht').getByRole('heading', { level: 3 })).toHaveText(['Bibimbap', 'Ramen'])
})

test('with Gekocht first, the Dishes of a deleted Column go to the first other Column by default', async ({ page }) => {
  await openSettings(page, async () => {
    await seedDish(page, { title: 'Pho', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  })
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '„Gekocht“ nach oben' }).click()
  await expectColumnNames(page, ['Gekocht', 'Ideen', 'Diese Woche'])

  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()

  await expect(page.getByRole('dialog', { name: '1 Gericht in „Diese Woche“. Wohin verschieben?' }).getByRole('radio', { name: 'Ideen' })).toBeChecked()
})

test('a Column that got Dishes since settings opened asks where they go instead of failing', async ({ page }) => {
  await openSettings(page)
  await seedDish(page, { title: 'Laksa', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })

  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()

  await expect(page.getByRole('dialog', { name: '1 Gericht in „Diese Woche“. Wohin verschieben?' })).toBeVisible()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht'])
})

test('a Column dragged by its grip moves, the Gekocht Column too', async ({ page }) => {
  await openSettings(page)
  const grip = (await row(page, 'Gekocht').locator('[data-grip]').boundingBox())!
  const target = (await row(page, 'Ideen').boundingBox())!

  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2, target.y + 4, { steps: 16 })
  await page.mouse.up()

  await expectColumnNames(page, ['Gekocht', 'Ideen', 'Diese Woche'])
  await reloadHydrated(page)
  await expectColumnNames(page, ['Gekocht', 'Ideen', 'Diese Woche'])
})
