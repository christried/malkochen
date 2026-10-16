import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { openBoardSettings } from './board'
import { gotoHydrated } from './hydration'
import { resetBoard, seedDish } from './seed'

// How the Board scrolls (#207). Opening a Dish keeps your place on it: the page stays where
// it was scrolled down a Column, and the Columns where they were scrolled
// sideways, while the Dish detail is open and after it closes. Edith's Board
// is used by this file only.
const EDITH = ALLOWLISTED[44]
const BLOG = 'https://kochblog.example/rezept'

// A window too small for the Board: its Columns are longer than it is tall
// and wider than it is across.
test.use({ viewport: { width: 800, height: 600 } })

test.beforeEach(async ({ page }) => {
  await signIn(page, EDITH)
  await resetBoard(page)
  for (let n = 1; n <= 8; n++) await seedDish(page, { title: `Eintopf ${n}`, sourceLink: `${BLOG}/${n}`, sourceKind: 'blog', column: 2 })
  await gotoHydrated(page, '/')
})

// Scrolls the Board as far down and as far sideways as it goes, and says
// where that is.
async function scrollBoard(page: Page) {
  const columns = page.getByTestId('columns')
  await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await columns.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }))
  const place = await scrolledTo(page)
  expect(place.down).toBeGreaterThan(100)
  expect(place.sideways).toBeGreaterThan(100)
  return place
}

function scrolledTo(page: Page) {
  return page.getByTestId('columns').evaluate(el => ({ down: Math.round(scrollY), sideways: Math.round(el.scrollLeft) }))
}

test('opening a Dish and closing it leaves the Board where it was scrolled, down and sideways', async ({ page }) => {
  const place = await scrollBoard(page)

  // The Dish at the very bottom of the last Column. Opened by keyboard: a
  // click retried while the card is still settling scrolls it into view
  // (block 'end', 'center' or 'start'), and that alone moves the Board
  // (#260).
  await page.getByRole('link', { name: 'Eintopf 1', exact: true }).evaluate(el => el.focus({ preventScroll: true }))
  await page.keyboard.press('Enter')
  const detail = page.getByRole('dialog', { name: 'Eintopf 1' })
  await expect(detail).toBeVisible()
  await detail.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  expect(await scrolledTo(page)).toEqual(place)

  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()
  await expect(page).toHaveURL(/\/b\/[^/]+$/)
  await expect(page.getByRole('link', { name: 'Eintopf 1', exact: true })).toBeFocused()
  expect(await scrolledTo(page)).toEqual(place)
})

test('another page still starts at the top', async ({ page }) => {
  await scrollBoard(page)

  await openBoardSettings(page)

  expect(await page.evaluate(() => scrollY)).toBe(0)
})

// Chromium draws a scrollbar from these pseudo-elements; the browser's own
// grey bar has none of it (`auto`, no thumb colour).
function scrollbarOf(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((el) => {
    const bar = getComputedStyle(el, '::-webkit-scrollbar')
    const thumb = getComputedStyle(el, '::-webkit-scrollbar-thumb')
    return { scrollsSideways: el.scrollWidth > el.clientWidth, height: bar.height, thumb: thumb.backgroundColor, radius: Number.parseFloat(thumb.borderTopLeftRadius) }
  })
}

test('with a mouse, the Columns’ sideways scrollbar is the app’s: thin, rounded, its thumb tinted', async ({ page }) => {
  const bar = await scrollbarOf(page, 'columns')

  expect(bar.scrollsSideways).toBe(true)
  expect(bar.height).toBe('10px')
  // Rounded to a pill: at least half its thickness.
  expect(bar.radius).toBeGreaterThanOrEqual(5)
  expect(bar.thumb).not.toBe('rgba(0, 0, 0, 0)')
})

// The vertical scrollbars are the app's too (#280): Your Settings' sheet, the
// Board Switcher's panel and the page down the Columns, in a window too
// short for each, in light and dark.
function verticalScrollbar(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((el) => {
    const bar = getComputedStyle(el, '::-webkit-scrollbar')
    const thumb = getComputedStyle(el, '::-webkit-scrollbar-thumb')
    return { scrollsDown: el.scrollHeight > el.clientHeight, width: bar.width, thumb: thumb.backgroundColor, radius: Number.parseFloat(thumb.borderTopLeftRadius) }
  })
}

function expectThin(bar: Awaited<ReturnType<typeof verticalScrollbar>>, what: string) {
  expect(bar, what).toMatchObject({ scrollsDown: true, width: '10px' })
  expect(bar.radius, what).toBeGreaterThanOrEqual(5)
  expect(bar.thumb, what).not.toBe('rgba(0, 0, 0, 0)')
}

for (const scheme of ['light', 'dark'] as const) {
  test(`with a mouse, the vertical scrollbars are the app’s: the page, Your Settings and the Board Switcher (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.setViewportSize({ width: 800, height: 320 })
    for (const name of ['Bildlauf A', 'Bildlauf B', 'Bildlauf C']) {
      expect((await page.request.post('/api/boards', { data: { name, emoji: '🥕' } })).status()).toBe(201)
    }
    await gotoHydrated(page, '/')
    expectThin(await verticalScrollbar(page.locator('html')), 'page')

    await page.getByRole('heading', { level: 1 }).getByRole('button').click()
    expectThin(await verticalScrollbar(page.getByRole('navigation', { name: 'Deine Boards' })), 'switcher')
    await page.keyboard.press('Escape')

    await gotoHydrated(page, '/settings')
    expectThin(await verticalScrollbar(page.getByRole('dialog', { name: 'Einstellungen', exact: true })), 'settings')
  })
}
