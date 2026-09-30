import { expect, test, type Page } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { seedDish } from './seed'

// Board settings (PRD stories 57–60, 62): the Board's name and emoji, and
// its Columns. Grace's Board: add-dish.spec.ts, the only other file using
// it, has run by now (files run one at a time, in order).
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// The Column names in settings, top to bottom, until they are `expected`.
async function expectColumnNames(page: Page, expected: string[]) {
  const fields = page.getByRole('list', { name: 'Spalten' }).getByRole('textbox')
  await expect.poll(() => fields.evaluateAll(els => els.map(el => (el as HTMLInputElement).value))).toEqual(expected)
}

async function openSettings(page: Page) {
  await signIn(page, ALLOWLISTED[1])
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Board-Einstellungen' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Board-Einstellungen' })).toBeVisible()
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
  const list = page.getByRole('list', { name: 'Spalten' })
  await expect(list.getByRole('listitem').filter({ hasText: 'Kann nicht gelöscht werden' })).toHaveCount(1)
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

test('an empty Column goes at once; one with Dishes asks where they go', async ({ page }) => {
  await openSettings(page)
  await page.getByRole('button', { name: 'Spalte „Für Gäste“ löschen' }).click()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht'])

  for (const title of ['Ramen', 'Bibimbap']) await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  await reloadHydrated(page)
  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()
  const dialog = page.getByRole('dialog', { name: '2 Gerichte in „Diese Woche“. Wohin verschieben?' })
  await expect(dialog.getByRole('radio', { name: 'Ideen' })).toBeChecked()
  await dialog.getByRole('radio', { name: 'Gekocht' }).check()
  await dialog.getByRole('button', { name: 'Verschieben und löschen' }).click()

  await expect(dialog).toBeHidden()
  await expectColumnNames(page, ['Ideen', 'Gekocht'])
  // The last Column besides Gekocht stays.
  await expect(page.getByRole('button', { name: 'Spalte „Ideen“ löschen' })).toBeDisabled()
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(column(page, 'Gekocht').getByRole('heading', { level: 3 })).toHaveText(['Bibimbap', 'Ramen'])
})

test('a Column dragged by its grip moves, the Gekocht Column too', async ({ page }) => {
  await openSettings(page)
  await expectColumnNames(page, ['Ideen', 'Gekocht'])
  const row = (name: string) => page.getByRole('listitem').filter({ has: page.getByRole('textbox', { name: `Name der Spalte „${name}“` }) })
  const grip = (await row('Gekocht').locator('[data-grip]').boundingBox())!
  const target = (await row('Ideen').boundingBox())!

  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2, target.y + 4, { steps: 12 })
  await page.mouse.up()

  await expectColumnNames(page, ['Gekocht', 'Ideen'])
  await reloadHydrated(page)
  await expectColumnNames(page, ['Gekocht', 'Ideen'])
})
