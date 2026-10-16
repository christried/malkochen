import type { Locator, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column, openBoardSettings } from './board'
import { gotoHydrated } from './hydration'
import { inviteToken } from './invite'
import { removeStoredImages, removeUsers, seedCookings, seedDish, storedImage } from './seed'
import { openUserSettings } from './settings-sheet'

// Text set in the type scale's tokens (tokens.json → type), where the visual
// check (#138) found it off them (#170). Marie and Émilie are used by this
// file only.
test.describe.configure({ mode: 'serial' })

const MARIE = ALLOWLISTED[34]
const EMILIE = ALLOWLISTED[35]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

test.beforeAll(() => removeUsers(MARIE, EMILIE))
test.afterAll(removeStoredImages)

async function font(locator: Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el)
    return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight }
  })
}

// `overline`: mono 11/1/600, 0.08em, uppercase (tokens.json → type.overline).
async function expectOverline(locator: Locator) {
  await expect(locator).toHaveCSS('font-family', /^ui-monospace/)
  await expect(locator).toHaveCSS('font-size', '11px')
  await expect(locator).toHaveCSS('font-weight', '600')
  await expect(locator).toHaveCSS('text-transform', 'uppercase')
}

// `small`: 13.5/1.3/500.
async function expectSmall(locator: Locator) {
  expect(await font(locator)).toMatchObject({ size: '13.5px', weight: '500' })
}

// A section's heading in a dialog or in settings (#205): one style for all of
// them, 16px semibold in the UI font and the text's own colour, written as
// it is (no capitals), so none gets lost.
async function expectSectionHeading(locator: Locator) {
  await expect(locator).toBeVisible()
  await expect(locator).toHaveCSS('font-family', /^Figtree/)
  await expect(locator).toHaveCSS('font-size', '16px')
  await expect(locator).toHaveCSS('font-weight', '600')
  await expect(locator).toHaveCSS('text-transform', 'none')
  const colours = await locator.evaluate(el => ({ own: getComputedStyle(el).color, text: getComputedStyle(document.documentElement).color }))
  expect(colours.own).toBe(colours.text)
}

function sectionHeadings(page: Page) {
  return page.getByRole('heading', { level: 2 })
}

test('user settings: the email and the languages note in `small`, the sections under one heading style', async ({ page }) => {
  await signIn(page, MARIE, { name: 'Marie' })
  const sheet = await openUserSettings(page)
  await expectSmall(sheet.getByText(MARIE))
  await expectSmall(sheet.getByText('Weitere Sprachen kommen später.'))
  // Under the sheet's own title.
  const headings = sheet.getByRole('heading', { level: 3 })
  await expect(headings).toHaveText(['Konto', 'Benachrichtigungen', 'Darstellung', 'Sprache', 'Tastenkürzel'])
  for (const heading of await headings.all()) await expectSectionHeading(heading)
})

test('Board settings: the sections under the same heading style, "(du)" in the name\'s weight', async ({ page }) => {
  await signIn(page, MARIE, { name: 'Marie' })
  await gotoHydrated(page, '/')
  await openBoardSettings(page)
  const headings = sectionHeadings(page)
  await expect(headings).toHaveText(['Board', 'Spalten', 'Mitglieder', 'Einladen'])
  for (const heading of await headings.all()) await expectSectionHeading(heading)
  // Muted text differs from the name by colour only.
  const you = page.getByText('(du)')
  const name = await font(you.locator('..'))
  expect(await font(you)).toMatchObject({ weight: name.weight, size: name.size })
  expect(name.weight).toBe('600')
})

test('a "Neu" pebble in mono, on one line, the size it had', async ({ page, browser }) => {
  await signIn(page, MARIE, { name: 'Marie' })
  const res = await page.request.post('/api/boards', { data: { name: 'Typo', emoji: '🥘' } })
  expect(res.status()).toBe(201)
  const { id: boardId } = await res.json() as { id: string }
  const token = await inviteToken(page, boardId)
  const emilie = await newTab(browser)
  await signIn(emilie, EMILIE, { name: 'Émilie' })
  expect((await emilie.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  expect((await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title: 'Maries Minestrone', placeholder: 'bowl' } })).status()).toBe(201)

  await gotoHydrated(emilie, `/b/${boardId}`)
  const neu = column(emilie, 'Ideen').getByRole('article', { name: 'Maries Minestrone' }).getByText('Neu')
  await expectOverline(neu)
  // One line: 11px text plus 4px padding above and below (its layout box:
  // the pebble is turned, so its bounding box is taller).
  expect(await neu.evaluate(el => (el as HTMLElement).offsetHeight)).toBe(19)
  await emilie.context().close()
})

test('Dish detail: the Achievement count in display weight, the link hint in `caption` weight', async ({ page }) => {
  await signIn(page, MARIE, { name: 'Marie' })
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Ratatouille', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 2 })
  await seedCookings(page, 'Ratatouille', 3)
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Ratatouille' }).click()
  const detail = page.getByRole('dialog', { name: 'Ratatouille' })
  const count = detail.getByTestId('achievement-badge').getByText('3×')
  await expect(count).toBeVisible()
  const counted = await font(count)
  expect(counted.family).toMatch(/^Petrona/)
  expect(counted.weight).toBe('500')
  expect(counted.lineHeight).toBe(counted.size)

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  const hint = detail.getByText('Ein neuer Link ändert das Bild nicht.', { exact: false })
  expect(await font(hint)).toMatchObject({ size: '12.5px', weight: '500' })
})

test('the Cooking note field in the field font, like the Dish note', async ({ page }) => {
  await signIn(page, MARIE, { name: 'Marie' })
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Ratatouille' }).click()
  const detail = page.getByRole('dialog', { name: 'Ratatouille' })
  await detail.locator('[data-cooking]').first().getByRole('button', { name: /^Notiz zum Kochen am .* hinzufügen$/ }).click()
  const note = page.getByRole('dialog', { name: 'Notiz zum Kochen' }).getByLabel('Notiz')
  expect(await font(note)).toMatchObject({ size: '15.5px', weight: '500', lineHeight: '22px' })
  await expect(note).toHaveCSS('font-family', /^Figtree/)
})

test('the image dialog\'s "Ausschnitt" and "Platzhalter" in the section heading style', async ({ page }) => {
  await signIn(page, MARIE, { name: 'Marie' })
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Shakshuka', sourceLink: TIKTOK, sourceKind: 'tiktok', imageUrl: await storedImage(360, 640) })
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Shakshuka' }).click()
  const detail = page.getByRole('dialog', { name: 'Shakshuka' })
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByRole('button', { name: 'Bild wählen' }).click()

  const dialog = page.getByRole('dialog', { name: 'Bild wählen' })
  await expect(dialog.getByRole('heading', { level: 3 })).toHaveText(['Ausschnitt', 'Platzhalter'])
  for (const heading of await dialog.getByRole('heading', { level: 3 }).all()) await expectSectionHeading(heading)
})

test('Add Dish\'s "Bild", a new Board\'s "Emoji" and the Dish menu\'s "Verschieben nach…" in the section heading style', async ({ page }) => {
  await signIn(page, MARIE, { name: 'Marie' })
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await page.getByRole('dialog', { name: 'Gericht hinzufügen' }).getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
  const addDish = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
  await expectSectionHeading(addDish.getByText('Bild', { exact: true }))
  await addDish.getByRole('button', { name: 'Schließen' }).click()

  await page.getByRole('button', { name: /Board wechseln/ }).click()
  await page.getByRole('navigation').getByRole('button', { name: 'Neues Board' }).click()
  const newBoard = page.getByRole('dialog', { name: 'Neues Board' })
  await expectSectionHeading(newBoard.getByText('Emoji', { exact: true }))
  await newBoard.getByRole('button', { name: 'Schließen' }).click()

  // Another Board, so the picker groups its Columns by Board, each group
  // under the same heading style (#280).
  expect((await page.request.post('/api/boards', { data: { name: 'Typoküche', emoji: '🥕' } })).status()).toBe(201)
  await page.getByRole('button', { name: 'Mehr zu „Shakshuka“' }).click()
  const menu = page.getByRole('dialog', { name: 'Shakshuka' })
  await menu.getByRole('button', { name: 'Verschieben nach…' }).click()
  await expectSectionHeading(menu.getByText('Verschieben nach…', { exact: true }))
  await expectSectionHeading(menu.getByText('Dieses Board', { exact: true }))
  await expectSectionHeading(menu.getByText('🥕 Typoküche', { exact: true }))
})
