import type { Locator, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { cardAtRest } from './board'
import { gotoHydrated } from './hydration'
import { removeUsers, resetBoard, seedCookings, seedDish } from './seed'
import { openUserSettings } from './settings-sheet'

// The Tooltip (#206): one styled Tooltip instead of the browser's own `title`
// tooltips. On a computer it comes up about 400 ms after the mouse rests on
// an icon button (or anything else that isn't self-explanatory), and at once
// when the keyboard focuses it; it goes when the mouse leaves, focus moves on
// or the control is clicked. Never on a touch screen. Vera's Board is used by
// this file only.
test.describe.configure({ mode: 'serial' })

const VERA = ALLOWLISTED[42]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const DESKTOP = { width: 1280, height: 800 }
const DELAY_MS = 400

function tooltip(page: Page) {
  return page.locator('[data-app-tooltip]')
}

// From here on, the page notes when the Tooltip opens and when the mouse
// came onto anything that has one.
async function watchTooltip(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { tooltipOpened: number[], pointerCame: number[] }
    w.tooltipOpened = []
    w.pointerCame = []
    document.querySelector('[data-app-tooltip]')!.addEventListener('beforetoggle', (event) => {
      if ((event as ToggleEvent).newState === 'open') w.tooltipOpened.push(performance.now())
    })
    document.addEventListener('pointerover', (event) => {
      if ((event.target as Element).closest('[data-tooltip]')) w.pointerCame.push(performance.now())
    }, true)
  })
}

function watched(page: Page) {
  return page.evaluate(() => {
    const { tooltipOpened, pointerCame } = window as unknown as { tooltipOpened: number[], pointerCame: number[] }
    return { opened: tooltipOpened, came: pointerCame }
  })
}

// Inside the viewport, and beside `control` rather than on it.
async function expectPlacedBy(page: Page, control: Locator) {
  const tip = (await tooltip(page).boundingBox())!
  const box = (await control.boundingBox())!
  const { width, height } = page.viewportSize()!
  expect(tip.x).toBeGreaterThanOrEqual(4)
  expect(tip.y).toBeGreaterThanOrEqual(4)
  expect(tip.x + tip.width).toBeLessThanOrEqual(width - 4)
  expect(tip.y + tip.height).toBeLessThanOrEqual(height - 4)
  const overlaps = tip.x < box.x + box.width && box.x < tip.x + tip.width && tip.y < box.y + box.height && box.y < tip.y + tip.height
  expect(overlaps).toBe(false)
  // Close by: within 16px above or below it.
  const gap = Math.max(tip.y - (box.y + box.height), box.y - (tip.y + tip.height))
  expect(gap).toBeLessThanOrEqual(16)
}

test.beforeAll(async ({ browser }) => {
  await removeUsers(VERA)
  const page = await newTab(browser)
  await signIn(page, VERA, { name: 'Vera' })
  await resetBoard(page)
  await seedDish(page, { title: 'Miso-Ramen', sourceLink: TIKTOK, sourceKind: 'tiktok', note: 'mit extra Knoblauch', addedBy: VERA, creator: '@nudelliebe' })
  await seedCookings(page, 'Miso-Ramen', 1)
  await page.context().close()
})

async function openBoard(page: Page) {
  await page.setViewportSize(DESKTOP)
  await signIn(page, VERA)
  await gotoHydrated(page, '/')
  await cardAtRest(page.getByRole('link', { name: 'Miso-Ramen', exact: true }))
  await page.mouse.move(0, 0)
  await watchTooltip(page)
}

test('on a computer an icon button’s Tooltip comes up about 400 ms after the mouse rests on it, and goes when the mouse leaves', async ({ page }) => {
  await openBoard(page)
  const search = page.getByRole('button', { name: 'Gerichte suchen' })
  await expect(tooltip(page)).toBeHidden()

  await search.hover()
  await expect(tooltip(page)).toBeVisible()
  await expect(tooltip(page)).toHaveText('Gerichte suchen')
  const { opened, came } = await watched(page)
  expect(opened).toHaveLength(1)
  const waited = opened[0]! - came[0]!
  expect(waited).toBeGreaterThanOrEqual(DELAY_MS - 30)
  expect(waited).toBeLessThan(DELAY_MS + 600)
  await expectPlacedBy(page, search)
  // For the eyes only: the button already has its name for screen readers.
  await expect(tooltip(page)).toHaveAttribute('aria-hidden', 'true')

  await page.mouse.move(0, 0)
  await expect(tooltip(page)).toBeHidden()

  // Passing over it without resting shows nothing.
  await search.hover()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(DELAY_MS + 200)
  await expect(tooltip(page)).toBeHidden()
  expect((await watched(page)).opened).toHaveLength(1)

  // The next icon button has its own.
  await page.getByRole('link', { name: 'Board-Einstellungen' }).hover()
  await expect(tooltip(page)).toHaveText('Board-Einstellungen')
})

test('keyboard focus shows a control’s Tooltip at once, focus moving on moves it, and Escape closes it', async ({ page }) => {
  await openBoard(page)

  // The first Tab lands on the Board switcher.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /Board wechseln/ })).toBeFocused()
  await expect(tooltip(page)).toHaveText('Board wechseln')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Gerichte suchen' })).toBeFocused()
  await expect(tooltip(page)).toHaveText('Gerichte suchen')

  await page.keyboard.press('Escape')
  await expect(tooltip(page)).toBeHidden()
  await expect(page.getByRole('button', { name: 'Gerichte suchen' })).toBeFocused()

  // Focus going to something without one closes it too.
  await page.keyboard.press('Shift+Tab')
  await expect(tooltip(page)).toHaveText('Board wechseln')
  await page.getByRole('link', { name: 'Miso-Ramen', exact: true }).focus()
  await expect(tooltip(page)).toBeHidden()

  // Focus put back on a control isn't asking about it: Escape in the Board
  // switcher's list hands focus back to the pill, without its Tooltip.
  const pill = page.getByRole('button', { name: /Board wechseln/ })
  await pill.focus()
  await page.keyboard.press('Enter')
  await expect(pill).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(pill).toBeFocused()
  await page.waitForTimeout(DELAY_MS + 200)
  await expect(tooltip(page)).toBeHidden()
  expect((await watched(page)).opened).toHaveLength(3)
})

test('a Dish dragged over a control shows no Tooltip', async ({ page }) => {
  await openBoard(page)
  const card = (await page.getByRole('link', { name: 'Miso-Ramen', exact: true }).boundingBox())!
  const settings = (await page.getByRole('link', { name: 'Board-Einstellungen' }).boundingBox())!

  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
  await page.mouse.down()
  await page.mouse.move(settings.x + settings.width / 2, settings.y + settings.height / 2, { steps: 12 })
  await expect(page.getByTestId('drag-card')).toBeVisible()
  await page.waitForTimeout(DELAY_MS + 200)
  await expect(tooltip(page)).toBeHidden()
  await page.mouse.up()
  await expect(page.getByTestId('drag-card')).toHaveCount(0)
  expect((await watched(page)).opened).toEqual([])
})

test('clicking a control closes its Tooltip, and it stays closed while the mouse rests there', async ({ page }) => {
  await openBoard(page)
  const pill = page.getByRole('button', { name: /Board wechseln/ })

  await pill.hover()
  await expect(tooltip(page)).toHaveText('Board wechseln')
  await pill.click()
  await expect(tooltip(page)).toBeHidden()
  await expect(pill).toHaveAttribute('aria-expanded', 'true')
  // Still resting on it, also when the mouse moves a little within it.
  const box = (await pill.boundingBox())!
  await page.mouse.move(box.x + box.width / 2 + 6, box.y + box.height / 2)
  await page.waitForTimeout(DELAY_MS + 200)
  await expect(tooltip(page)).toBeHidden()

  // Leaving and coming back shows it again.
  await page.mouse.move(0, 400)
  await pill.hover()
  await expect(tooltip(page)).toHaveText('Board wechseln')
})

test('a Tooltip shows above a sheet, and what used to be a native title is a Tooltip', async ({ page }) => {
  await openBoard(page)
  const card = page.getByRole('link', { name: 'Miso-Ramen', exact: true })

  // On the card: the Creator, who added it, and that it has a note.
  for (const [part, text] of [['[data-creator]', '@nudelliebe'], ['[data-added-by]', 'Hinzugefügt von Vera'], ['[data-note-icon]', 'Mit Notiz']] as const) {
    await card.locator(part).hover()
    await expect(tooltip(page)).toHaveText(text)
    await page.mouse.move(0, 0)
    await expect(tooltip(page)).toBeHidden()
  }

  // A sheet is in the top layer; the Tooltip of its close button is above it.
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  const close = sheet.getByRole('button', { name: 'Schließen' })
  await sheet.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).filter(a => a.timeline === document.timeline).map(a => a.finished)))
  await close.hover()
  await expect(tooltip(page)).toHaveText('Schließen')
  await expectPlacedBy(page, close)
  // Shown after the sheet opened, so it is the top layer's last: above it.
  expect(await tooltip(page).evaluate(el => el.matches(':popover-open'))).toBe(true)
})

test('a Tooltip near the screen’s edge stays on the screen', async ({ page }) => {
  await openBoard(page)
  const account = page.getByRole('button', { name: 'Dein Konto' })

  await account.hover()
  await expect(tooltip(page)).toHaveText('Dein Konto')
  await expectPlacedBy(page, account)

  // The add button sits at the bottom: its Tooltip goes above it.
  const add = page.getByRole('button', { name: 'Gericht hinzufügen' })
  await add.hover()
  await expect(tooltip(page)).toHaveText('Gericht hinzufügen')
  await expectPlacedBy(page, add)
  expect((await tooltip(page).boundingBox())!.y).toBeLessThan((await add.boundingBox())!.y)
})

// Every button and link that shows no text of its own, by what it is called.
function unexplained(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('button, a[href], [role="button"]')]
    .filter(el => el.checkVisibility() && !el.closest('[inert]') && !el.innerText.trim() && !el.dataset.tooltip)
    .map(el => el.getAttribute('aria-label') ?? el.outerHTML.slice(0, 120)))
}

test('no native title is left, and every icon button says what it does in a Tooltip', async ({ page }) => {
  await openBoard(page)
  const nativeTitles = () => page.locator('[title]:not(iframe), svg title').count()

  expect(await nativeTitles()).toBe(0)
  expect(await unexplained(page)).toEqual([])

  // The card's "…" says so in a word, not with the Dish's whole title.
  await page.getByRole('button', { name: 'Mehr zu „Miso-Ramen“' }).hover()
  await expect(tooltip(page)).toHaveText('Mehr')

  // The Dish detail, with a Cooking in its history.
  await page.getByRole('link', { name: 'Miso-Ramen', exact: true }).click()
  const detail = page.getByRole('dialog', { name: 'Miso-Ramen' })
  await expect(detail.locator('[data-cooking]')).toHaveCount(1)
  expect(await nativeTitles()).toBe(0)
  expect(await unexplained(page)).toEqual([])
  await detail.locator('[data-cooking]').getByRole('button', { name: /löschen$/ }).hover()
  await expect(tooltip(page)).toHaveText('Kochen löschen')
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(detail).toHaveCount(0)

  // Board settings: the arrows and the ✕ of a Column.
  await page.getByRole('link', { name: 'Board-Einstellungen' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Board-Einstellungen' })).toBeVisible()
  expect(await nativeTitles()).toBe(0)
  expect(await unexplained(page)).toEqual([])
  for (const [name, text] of [['„Ideen“ nach unten', 'Nach unten'], ['„Diese Woche“ nach oben', 'Nach oben'], ['Spalte „Ideen“ löschen', 'Spalte löschen'], ['Zurück zum Board', 'Zurück zum Board'], ['Emoji ändern', 'Emoji ändern']] as const) {
    await page.getByRole(name === 'Zurück zum Board' ? 'link' : 'button', { name }).hover()
    await expect(tooltip(page)).toHaveText(text)
  }
  // A disabled arrow has nothing to say.
  await page.mouse.move(0, 0)
  await expect(tooltip(page)).toBeHidden()
  await page.getByRole('button', { name: '„Ideen“ nach oben' }).hover({ force: true })
  await page.waitForTimeout(DELAY_MS + 200)
  await expect(tooltip(page)).toBeHidden()

  // Your own settings.
  await openUserSettings(page)
  expect(await nativeTitles()).toBe(0)
  expect(await unexplained(page)).toEqual([])
})

test('on a touch screen, tapping or long-pressing an icon button never shows a Tooltip', async ({ browser }) => {
  const page = await newTab(browser, { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  await signIn(page, VERA)
  await gotoHydrated(page, '/')
  await cardAtRest(page.getByRole('link', { name: 'Miso-Ramen', exact: true }))
  await watchTooltip(page)
  const settings = page.getByRole('link', { name: 'Board-Einstellungen' })
  const search = page.getByRole('button', { name: 'Gerichte suchen' })

  // A long press: a finger down on the icon button for a second, then up.
  const touches = await page.context().newCDPSession(page)
  for (const control of [settings, search]) {
    const box = (await control.boundingBox())!
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await touches.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] })
    await page.waitForTimeout(1000)
    await expect(tooltip(page)).toBeHidden()
    await touches.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  }
  await touches.detach()

  // A tap: the search opens, and no Tooltip with it or after it.
  await search.tap()
  await expect(page.getByRole('searchbox', { name: 'Gerichte suchen' })).toBeVisible()
  await page.waitForTimeout(DELAY_MS + 300)
  await expect(tooltip(page)).toBeHidden()
  await page.getByRole('button', { name: 'Suche schließen' }).tap()
  await page.waitForTimeout(DELAY_MS + 300)
  await expect(tooltip(page)).toBeHidden()

  expect((await watched(page)).opened).toEqual([])
  await page.context().close()
})
