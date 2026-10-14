import type { Locator, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { cardAtRest, column } from './board'
import { gotoHydrated } from './hydration'
import { removeUsers, resetBoard, seedDish } from './seed'

// A Dish's note on its card (#212): the note icon shows the note itself, in
// the Tooltip on a computer (hover or keyboard focus) and in the same bubble
// on a tap on the phone, without opening the Dish. Ada Lovelace's Board is
// used by this file only.
test.describe.configure({ mode: 'serial' })

const LOVELACE = ALLOWLISTED[59]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const NOTE = 'mit extra Knoblauch\nund ohne Koriander'
const LONG_NOTE = 'Am Vortag einweichen, dann zwei Stunden köcheln lassen. '.repeat(8).trim()
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }

function tooltip(page: Page) {
  return page.locator('[data-app-tooltip]')
}

function card(page: Page, title: string) {
  return column(page, 'Ideen').getByRole('listitem').filter({ has: page.getByRole('link', { name: title, exact: true }) })
}

function noteButton(page: Page, title: string) {
  return card(page, title).getByRole('button', { name: /^Notiz:/ })
}

// Fully on the screen.
async function expectOnScreen(page: Page, el: Locator) {
  const box = (await el.boundingBox())!
  const { width, height } = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)
  expect(box.y + box.height).toBeLessThanOrEqual(height)
}

test.beforeAll(async ({ browser }) => {
  await removeUsers(LOVELACE)
  const page = await newTab(browser)
  await signIn(page, LOVELACE, { name: 'Ada' })
  await resetBoard(page)
  await seedDish(page, { title: 'Linsensuppe', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedDish(page, { title: 'Bohneneintopf', sourceLink: TIKTOK, sourceKind: 'tiktok', note: LONG_NOTE })
  await seedDish(page, { title: 'Miso-Ramen', sourceLink: TIKTOK, sourceKind: 'tiktok', note: NOTE, addedBy: LOVELACE })
  await page.context().close()
})

async function openBoard(page: Page) {
  await signIn(page, LOVELACE)
  await gotoHydrated(page, '/')
  await cardAtRest(page.getByRole('link', { name: 'Miso-Ramen', exact: true }))
}

test('on a computer, hovering the note icon shows the note in the Tooltip, and the Dish stays closed', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await openBoard(page)
  const url = page.url()
  const icon = noteButton(page, 'Miso-Ramen')

  // Its name for screen readers is the note, not only that there is one.
  await expect(icon).toHaveAccessibleName(`Notiz: ${NOTE}`)
  await expect(page.getByText('Mit Notiz')).toHaveCount(0)

  await icon.hover()
  await expect(tooltip(page)).toBeVisible()
  // Its line breaks kept.
  expect(await tooltip(page).innerText()).toBe(NOTE)
  await expectOnScreen(page, tooltip(page))
  // The button sits on the icon the card draws.
  const drawn = (await card(page, 'Miso-Ramen').locator('[data-note-drawn]').boundingBox())!
  const hit = (await icon.boundingBox())!
  expect(Math.abs((hit.x + hit.width / 2) - (drawn.x + drawn.width / 2))).toBeLessThanOrEqual(1)
  expect(Math.abs((hit.y + hit.height / 2) - (drawn.y + drawn.height / 2))).toBeLessThanOrEqual(1)

  // Clicking it opens nothing either.
  await icon.click()
  await page.waitForTimeout(500)
  expect(page.url()).toBe(url)

  // A long note wraps within its width and stays on the screen.
  await page.mouse.move(0, 0)
  await noteButton(page, 'Bohneneintopf').hover()
  await expect(tooltip(page)).toHaveText(LONG_NOTE)
  expect((await tooltip(page).boundingBox())!.width).toBeLessThanOrEqual(281)
  await expectOnScreen(page, tooltip(page))

  // No note, no icon.
  await expect(card(page, 'Linsensuppe').getByRole('button', { name: /^Notiz:/ })).toHaveCount(0)
  await expect(card(page, 'Linsensuppe').locator('[data-note-drawn]')).toHaveCount(0)
  expect(page.url()).toBe(url)
})

test('keyboard focus on the note icon shows the note, and moving on or Escape hides it', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await openBoard(page)
  const link = page.getByRole('link', { name: 'Miso-Ramen', exact: true })
  const icon = noteButton(page, 'Miso-Ramen')

  await link.focus()
  // From the card, Tab reaches its note icon.
  await page.keyboard.press('Tab')
  await expect(icon).toBeFocused()
  await expect(tooltip(page)).toBeVisible()
  expect(await tooltip(page).innerText()).toBe(NOTE)

  await page.keyboard.press('Escape')
  await expect(tooltip(page)).toBeHidden()

  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(tooltip(page)).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(icon).not.toBeFocused()
  await expect(tooltip(page)).not.toHaveText(NOTE)
})

test('on a phone, tapping the note icon shows the note by it; tapping it again or elsewhere closes it, and the card still opens', async ({ browser }) => {
  const page = await newTab(browser, { hasTouch: true, isMobile: true, viewport: PHONE })
  await openBoard(page)
  const url = page.url()
  const icon = noteButton(page, 'Miso-Ramen')

  await icon.tap()
  await expect(tooltip(page)).toBeVisible()
  expect(await tooltip(page).innerText()).toBe(NOTE)
  await expectOnScreen(page, tooltip(page))
  // By the icon: within 16px above or below it.
  const tip = (await tooltip(page).boundingBox())!
  const box = (await icon.boundingBox())!
  expect(Math.max(tip.y - (box.y + box.height), box.y - (tip.y + tip.height))).toBeLessThanOrEqual(16)
  // Neither the Dish nor a drag.
  await page.waitForTimeout(500)
  expect(page.url()).toBe(url)
  await expect(page.getByTestId('drag-card')).toHaveCount(0)
  await expect(tooltip(page)).toBeVisible()

  // The icon again closes it.
  await icon.tap()
  await expect(tooltip(page)).toBeHidden()
  await icon.tap()
  await expect(tooltip(page)).toBeVisible()

  // Anywhere else too: the empty lane under the cards.
  await page.touchscreen.tap(40, PHONE.height - 160)
  await expect(tooltip(page)).toBeHidden()

  // A long note stays on the phone's screen.
  await noteButton(page, 'Bohneneintopf').tap()
  await expect(tooltip(page)).toHaveText(LONG_NOTE)
  await expectOnScreen(page, tooltip(page))

  // The rest of the card still opens the Dish, and closes the note.
  await page.getByRole('link', { name: 'Miso-Ramen', exact: true }).getByRole('heading').tap()
  await expect(page).toHaveURL(/\/b\/[^/]+\/[^/]+$/)
  await expect(tooltip(page)).toBeHidden()
  await page.context().close()
})
