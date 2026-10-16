import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated } from './hydration'
import { removeUsers, seedDish } from './seed'
import { openUserSettings } from './settings-sheet'

// The Board's keyboard shortcuts (#182): N, /, Esc, ",", 1–9 and ?, at any
// width, never while typing in a field or with a dialog or the Dish detail
// open; and the same list in your settings. Florence is used by this file
// only.

test.describe.configure({ mode: 'serial' })

const FLORENCE = ALLOWLISTED[38]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

test.beforeAll(() => removeUsers(FLORENCE))

function heading(page: Page) {
  return page.getByRole('heading', { level: 1 })
}

// Once the Board named `name` has opened: its skeleton shows the name
// already, but not the search button, and the shortcuts wait for the Board.
async function boardOpened(page: Page, name: string) {
  await expect(heading(page)).toContainText(name)
  await expect(page.getByRole('button', { name: 'Gerichte suchen' })).toBeVisible()
}

test('N opens Add Dish, also on a phone with a keyboard, but not while typing in a field', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, FLORENCE)
  await seedDish(page, { title: 'Cremige Pilzpasta', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  await page.keyboard.press('n')
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await expect(sheet).toBeVisible()
  // The key itself wasn't typed into the sheet's field.
  await expect(sheet.getByRole('textbox').first()).toHaveValue('')
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  await page.getByRole('button', { name: 'Gerichte suchen' }).click()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).press('n')
  await expect(page.getByRole('searchbox', { name: 'Gerichte suchen' })).toHaveValue('n')
  await expect(sheet).toBeHidden()
})

test('/ opens the search, and Esc closes it again', async ({ page }) => {
  await signIn(page, FLORENCE)
  await gotoHydrated(page, '/')

  await page.keyboard.press('/')
  const field = page.getByRole('searchbox', { name: 'Gerichte suchen' })
  await expect(field).toBeFocused()
  await expect(field).toHaveValue('')
  await field.fill('pilz')
  await expect(page.getByTestId('search-results').getByRole('heading', { level: 3 })).toHaveText(['Cremige Pilzpasta'])

  // Esc in the Board switcher closes only the switcher.
  await page.getByRole('heading', { level: 1 }).getByRole('button').click()
  await expect(page.getByRole('navigation', { name: 'Deine Boards' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation', { name: 'Deine Boards' })).toHaveCount(0)
  await expect(field).toHaveValue('pilz')

  // With focus out of the field, Esc still closes the search.
  await field.blur()
  await page.keyboard.press('Escape')
  await expect(field).toBeHidden()
  await expect(column(page, 'Ideen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gerichte suchen' })).toBeFocused()
})

test('Esc closes the Dish detail, and while it is open the other keys do nothing', async ({ page }) => {
  await signIn(page, FLORENCE)
  await gotoHydrated(page, '/')

  await page.getByRole('link', { name: 'Cremige Pilzpasta' }).click()
  const detail = page.getByRole('dialog', { name: 'Cremige Pilzpasta' })
  await expect(detail).toBeVisible()
  await page.keyboard.press('n')
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Gericht hinzufügen' })).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Tastenkürzel' })).toBeHidden()

  await page.keyboard.press('Escape')
  await expect(detail).toBeHidden()
  await expect(page).not.toHaveURL(/pilzpasta/)
})

test('"," opens the Board settings', async ({ page }) => {
  await signIn(page, FLORENCE)
  await gotoHydrated(page, '/')

  await page.keyboard.press(',')
  await expect(page.getByRole('heading', { level: 1, name: 'Board-Einstellungen' })).toBeVisible()
  await expect(page).toHaveURL(/\/b\/[^/]+\/settings$/)
})

test('in the open Board switcher, Tab reaches a row and then its Board Settings button, which Enter opens', async ({ page }) => {
  await signIn(page, FLORENCE)
  await gotoHydrated(page, '/')

  const pill = page.getByRole('heading', { level: 1 }).getByRole('button')
  await pill.focus()
  await page.keyboard.press('Enter')
  const firstRow = page.getByRole('navigation', { name: 'Deine Boards' }).getByRole('listitem').first()
  await page.keyboard.press('Tab')
  await expect(firstRow.getByRole('link').first()).toBeFocused()
  await page.keyboard.press('Tab')
  const settings = firstRow.getByRole('link', { name: /^Board-Einstellungen: / })
  await expect(settings).toBeFocused()
  const name = (await settings.getAttribute('aria-label'))!.replace('Board-Einstellungen: ', '')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { level: 1, name: 'Board-Einstellungen' })).toBeVisible()
  await expect(page).toHaveURL(/\/b\/[^/]+\/settings$/)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name)
})

test('1 to 9 switch to the Boards in the switcher\'s order; a number with no Board does nothing', async ({ page }) => {
  await signIn(page, FLORENCE)
  const res = await page.request.post('/api/boards', { data: { name: 'Daheim', emoji: '🌱' } })
  expect(res.status()).toBe(201)
  await gotoHydrated(page, '/')

  await page.getByRole('heading', { level: 1 }).getByRole('button').click()
  // Florence's starter Board and Daheim, in the switcher's order.
  // The Boards' rows, not their Board Settings buttons.
  const rows = page.getByRole('navigation', { name: 'Deine Boards' }).getByRole('link', { name: /^(?!Board-Einstellungen: )/ })
  await expect(rows).toHaveText([/Meine Küche|Daheim/, /Meine Küche|Daheim/])
  const [first, second] = (await rows.allTextContents()).map(row => row.includes('Daheim') ? 'Daheim' : 'Meine Küche')
  expect(first).not.toBe(second)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation', { name: 'Deine Boards' })).toHaveCount(0)

  await page.keyboard.press('2')
  await boardOpened(page, second!)
  await page.keyboard.press('1')
  await boardOpened(page, first!)

  const url = page.url()
  const fetched = page.waitForResponse(r => new URL(r.url()).pathname === '/api/boards' && r.request().method() === 'GET')
  await page.keyboard.press('3')
  await fetched
  await page.waitForTimeout(300)
  expect(page.url()).toBe(url)
  await expect(heading(page)).toContainText(first!)
})

// The lines the "?" dialog and the settings section both list: the
// shortcuts, and selecting several Dishes with a click (#280).
const LINES = [
  /^N\s*Gericht hinzufügen$/,
  /^\/\s*Gerichte suchen$/,
  /^Esc\s*Schließt, was offen ist/,
  /^,\s*Board-Einstellungen$/,
  /^1\s*–\s*9\s*Zum 1\. bis 9\. Board wechseln$/,
  /^\?\s*Diese Tastenkürzel zeigen$/,
  /^Strg\s*\+\s*Klick\s*Mehrere auswählen$/,
]

test('? lists the shortcuts in a dialog, which OK closes', async ({ page }) => {
  await signIn(page, FLORENCE)
  await gotoHydrated(page, '/')

  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog', { name: 'Tastenkürzel' })
  await expect(dialog.getByRole('listitem')).toHaveText(LINES)
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(dialog).toBeHidden()
})

test('your settings explain the same shortcuts', async ({ page }) => {
  await signIn(page, FLORENCE)
  await openUserSettings(page)

  const section = page.getByRole('region', { name: 'Tastenkürzel' })
  await expect(section.getByRole('listitem')).toHaveText(LINES)
})

// On Apple devices the modifier is ⌘, in both places (#280).
test('on a Mac, selecting several Dishes says ⌘ instead of Strg', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => ({ platform: 'macOS' }) })
    Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' })
  })
  await signIn(page, FLORENCE)
  await gotoHydrated(page, '/')

  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog', { name: 'Tastenkürzel' })
  await expect(dialog.getByRole('listitem').last()).toHaveText(/^⌘\s*\+\s*Klick\s*Mehrere auswählen$/)
  await dialog.getByRole('button', { name: 'OK' }).click()

  await openUserSettings(page)
  const section = page.getByRole('region', { name: 'Tastenkürzel' })
  await expect(section.getByRole('listitem').last()).toHaveText(/^⌘\s*\+\s*Klick\s*Mehrere auswählen$/)
})

// Shortcuts need a keyboard, so the section is only on devices with a fine
// pointer that can hover, never on a touch phone, whatever its width (#280).
test('your settings leave the shortcuts out on a touch phone', async ({ browser }) => {
  const page = await newTab(browser, { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  await signIn(page, FLORENCE)
  const sheet = await openUserSettings(page)

  await expect(sheet.getByRole('region', { name: 'Sprache' })).toBeVisible()
  await expect(sheet.getByRole('region', { name: 'Tastenkürzel' })).toBeHidden()
  await page.context().close()
})
