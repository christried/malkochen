import type { Locator, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { tab, titles } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { landingBoardId, removeUsers, seedDish } from './seed'

// Moving or deleting several Dishes at once (#218): Ctrl-click on desktop
// or a long-press on phones selects a Dish; the bar at the bottom says how
// many are selected and moves or deletes them all, with undo. Nettie's
// Board is used by this file only; Gerty joins it as a second Member.
test.describe.configure({ mode: 'serial' })
const NETTIE = ALLOWLISTED[48]
const GERTY = ALLOWLISTED[49]
test.beforeAll(() => removeUsers(NETTIE, GERTY))

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }

function card(page: Page, title: string) {
  return page.getByRole('link', { name: title, exact: true })
}

function checkbox(page: Page, title: string) {
  return page.getByRole('checkbox', { name: title, exact: true })
}

function bar(page: Page) {
  return page.getByRole('toolbar', { name: 'Auswahl' })
}

async function ctrlClick(locator: Locator) {
  await locator.click({ modifiers: ['Control'] })
}

// A finger long-pressing a card by its middle and letting go where it
// pressed, as touch pointer events.
async function longPress(page: Page, target: Locator) {
  const box = (await target.boundingBox())!
  const at = { pointerId: 12, pointerType: 'touch', isPrimary: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true }
  await target.dispatchEvent('pointerdown', at)
  await page.waitForTimeout(450)
  await page.getByTestId('columns').dispatchEvent('pointerup', at)
  await expect(page.getByTestId('drag-card')).toHaveCount(0)
}

test('desktop: Ctrl-click selects Dishes across Columns, the bar counts them, Escape leaves with nothing changed', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, NETTIE)
  for (const title of ['Kürbissuppe', 'Bowl']) await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  for (const title of ['Curry', 'Ramen', 'Tacos']) await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Ramen', 'Curry'])

  await ctrlClick(card(page, 'Ramen'))

  await expect(bar(page)).toContainText('1 ausgewählt')
  await expect(checkbox(page, 'Ramen')).toBeChecked()
  await expect(checkbox(page, 'Tacos')).not.toBeChecked()
  // No Dish opens while Dishes are selected: a click selects instead, in any Column.
  await checkbox(page, 'Bowl').click()
  await checkbox(page, 'Curry').click()
  await expect(bar(page)).toContainText('3 ausgewählt')
  await checkbox(page, 'Curry').click()
  await expect(bar(page)).toContainText('2 ausgewählt')
  await expect(page).toHaveURL(/\/b\/[^/]+$/)
  // No bulk "Gekocht": cooking stays one Dish at a time.
  await expect(bar(page).getByRole('button')).toHaveText(['', 'Verschieben', 'Löschen'])
  await expect(page.getByRole('button', { name: /^Gekocht/ })).toHaveCount(0)

  await page.keyboard.press('Escape')

  await expect(bar(page)).toBeHidden()
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Ramen', 'Curry'])
  await expect(titles(page, 'Diese Woche')).toHaveText(['Bowl', 'Kürbissuppe'])
  // A plain click opens the Dish again.
  await card(page, 'Ramen').click()
  await expect(page.getByRole('dialog', { name: 'Ramen' })).toBeVisible()
})

test('desktop: deselecting the last Dish leaves the selection, as does its ×', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, NETTIE)
  await gotoHydrated(page, '/')

  await ctrlClick(card(page, 'Tacos'))
  await checkbox(page, 'Tacos').click()
  await expect(bar(page)).toBeHidden()

  await ctrlClick(card(page, 'Tacos'))
  await bar(page).getByRole('button', { name: 'Auswahl beenden' }).click()
  await expect(bar(page)).toBeHidden()
  await expect(card(page, 'Tacos')).toBeVisible()
})

test('desktop: several Dishes move together, another Member sees it, and undo puts each back in its place', async ({ page, browser }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, NETTIE)
  const boardId = await landingBoardId(page)
  const gerty = await newTab(browser)
  await signIn(gerty, GERTY)
  expect((await gerty.request.post(`/api/invites/${await inviteToken(page, boardId)}/join`)).status()).toBe(200)
  await gotoHydrated(gerty, `/b/${boardId}`)
  await gotoHydrated(page, '/')

  await ctrlClick(card(page, 'Tacos'))
  await checkbox(page, 'Curry').click()
  await checkbox(page, 'Bowl').click()
  await bar(page).getByRole('button', { name: 'Verschieben' }).click()
  const picker = page.getByRole('dialog', { name: 'Verschieben nach…' })
  // Every Column but the Gekocht Column.
  await expect(picker.getByRole('button')).toHaveText(['', /Ideen/, /Diese Woche/])
  await picker.getByRole('button', { name: 'Diese Woche' }).click()

  await expect(bar(page)).toBeHidden()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Tacos', 'Curry', 'Bowl', 'Kürbissuppe'])
  await expect(titles(page, 'Ideen')).toHaveText(['Ramen'])
  const toast = page.getByRole('status').filter({ hasText: '2 Gerichte nach „Diese Woche“ verschoben' })
  await expect(toast).toBeVisible()
  await expect(titles(gerty, 'Diese Woche')).toHaveText(['Tacos', 'Curry', 'Bowl', 'Kürbissuppe'], { timeout: 10_000 })

  await toast.getByRole('button', { name: 'Rückgängig' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Ramen', 'Curry'])
  await expect(titles(page, 'Diese Woche')).toHaveText(['Bowl', 'Kürbissuppe'])
  await reloadHydrated(page)
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Ramen', 'Curry'])
  await expect(titles(page, 'Diese Woche')).toHaveText(['Bowl', 'Kürbissuppe'])
  await gerty.context().close()
})

test('desktop: several Dishes are deleted together, and undo brings every one back as it was', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, NETTIE)
  await seedDish(page, { title: 'Pilzrisotto', sourceLink: TIKTOK, sourceKind: 'tiktok', note: 'Mit Thymian', creator: '@christried' })
  await gotoHydrated(page, '/')

  await ctrlClick(card(page, 'Pilzrisotto'))
  await checkbox(page, 'Ramen').click()
  await checkbox(page, 'Kürbissuppe').click()
  await bar(page).getByRole('button', { name: 'Löschen' }).click()

  await expect(bar(page)).toBeHidden()
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Curry'])
  await expect(titles(page, 'Diese Woche')).toHaveText(['Bowl'])
  const toast = page.getByRole('status').filter({ hasText: '3 Gerichte gelöscht' })

  await toast.getByRole('button', { name: 'Rückgängig' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Pilzrisotto', 'Tacos', 'Ramen', 'Curry'])
  await expect(titles(page, 'Diese Woche')).toHaveText(['Bowl', 'Kürbissuppe'])
  await reloadHydrated(page)
  await expect(titles(page, 'Ideen')).toHaveText(['Pilzrisotto', 'Tacos', 'Ramen', 'Curry'])
  await card(page, 'Pilzrisotto').click()
  const detail = page.getByRole('dialog', { name: 'Pilzrisotto' })
  await expect(detail).toContainText('Mit Thymian')
  await expect(detail).toContainText('@christried')
})

test('phone: a long-press selects a Dish, taps add Dishes from other Columns, and they move to another Board', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, NETTIE)
  const other = await page.request.post('/api/boards', { data: { name: 'Vorrat', emoji: '🥫' } })
  expect(other.status()).toBe(201)
  const otherId = (await other.json() as { id: string }).id
  // Opening a Board makes it the landing one: back to Nettie's first.
  const home = (await (await page.request.get('/api/boards')).json() as { id: string, name: string }[]).find(b => b.id !== otherId)!
  await gotoHydrated(page, `/b/${home.id}`)
  await expect(titles(page, 'Ideen')).toHaveText(['Pilzrisotto', 'Tacos', 'Ramen', 'Curry'])

  await longPress(page, card(page, 'Ramen'))

  await expect(bar(page)).toContainText('1 ausgewählt')
  await expect(checkbox(page, 'Ramen')).toBeChecked()
  // Still in Ideen: the long-press didn't drag it.
  await expect(titles(page, 'Ideen')).toHaveText(['Pilzrisotto', 'Tacos', 'Ramen', 'Curry'])
  await checkbox(page, 'Tacos').click()
  await tab(page, 'Diese Woche 2').click()
  await checkbox(page, 'Bowl').click()
  await expect(bar(page)).toContainText('3 ausgewählt')

  await bar(page).getByRole('button', { name: 'Verschieben' }).click()
  const picker = page.getByRole('dialog', { name: 'Verschieben nach…' })
  await picker.getByRole('region', { name: 'Vorrat' }).getByRole('button', { name: 'Diese Woche' }).click()

  await expect(bar(page)).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: '3 Gerichte sind jetzt in 🥫 Vorrat · Diese Woche' })).toBeVisible()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Kürbissuppe'])
  await tab(page, 'Ideen 2').click()
  await expect(titles(page, 'Ideen')).toHaveText(['Pilzrisotto', 'Curry'])
  await gotoHydrated(page, `/b/${otherId}`)
  await tab(page, 'Diese Woche 3').click()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Tacos', 'Ramen', 'Bowl'])
})
