import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { landingBoardId, resetBoard, seedDish, setColumns } from './seed'

// The edge indicators (#208): where the window cuts Columns off, a button on
// that edge of the Board says so and steps one Column that way. Lynn's Board
// is used by this file only.
const LYNN = ALLOWLISTED[45]

// A window that shows two of the five Columns and a bit of the third.
const NARROW = { width: 800, height: 600 }
// Wide enough for three Columns and the add lane.
const WIDE = { width: 1600, height: 900 }
const FIVE = ['Ideen', 'Diese Woche', 'Wochenende', 'Für Gäste', 'Gekocht']
// From one lane's left edge to the next one's: a lane (340px) and the gap.
const STEP = 356

const previous = (page: Page) => page.getByRole('button', { name: 'Vorherige Spalte' })
const next = (page: Page) => page.getByRole('button', { name: 'Nächste Spalte' })

async function openBoard(page: Page, columns = FIVE) {
  await signIn(page, LYNN)
  await resetBoard(page)
  await setColumns(page, columns)
  await gotoHydrated(page, '/')
}

// How far the Columns are scrolled sideways, once they have come to rest
// there.
async function expectScrolledTo(page: Page, left: number) {
  await expect.poll(() => page.getByTestId('columns').evaluate(el => Math.round(el.scrollLeft))).toBe(left)
}

test.use({ viewport: NARROW })

test('with Columns cut off on the right, only the right edge has an indicator', async ({ page }) => {
  await openBoard(page)

  await expect(next(page)).toBeVisible()
  await expect(previous(page)).toHaveCount(0)
})

test('an indicator steps exactly one Column its way, and goes at the first and the last Column', async ({ page }) => {
  await openBoard(page)

  await next(page).click()
  await expectScrolledTo(page, STEP)
  await expect(previous(page)).toBeVisible()

  await next(page).click()
  await expectScrolledTo(page, 2 * STEP)
  // The last step ends where the Board does, less than a whole Column on.
  await next(page).click()
  const end = await page.getByTestId('columns').evaluate(el => el.scrollWidth - el.clientWidth)
  await expectScrolledTo(page, end)
  await expect(next(page)).toHaveCount(0)
  await expect(previous(page)).toBeVisible()

  await previous(page).click()
  await expectScrolledTo(page, 2 * STEP)
  await expect(next(page)).toBeVisible()
  await previous(page).click()
  await previous(page).click()
  await expectScrolledTo(page, 0)
  await expect(previous(page)).toHaveCount(0)
})

test('two quick clicks go two Columns on', async ({ page }) => {
  await openBoard(page)

  await next(page).evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })

  await expectScrolledTo(page, 2 * STEP)
})

test('scrolling by wheel or by the scrollbar changes which indicators show', async ({ page }) => {
  await openBoard(page)
  const columns = page.getByTestId('columns')

  await columns.hover()
  await page.mouse.wheel(400, 0)
  await expectScrolledTo(page, STEP)
  await expect(previous(page)).toBeVisible()
  await expect(next(page)).toBeVisible()

  await columns.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }))
  await expect(next(page)).toHaveCount(0)
  await expect(previous(page)).toBeVisible()

  await columns.evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }))
  await expect(previous(page)).toHaveCount(0)
  await expect(next(page)).toBeVisible()
})

test('no indicator while every Column fits; one shows once the window narrows or a Column is added', async ({ page }) => {
  await page.setViewportSize(WIDE)
  await openBoard(page, ['Ideen', 'Diese Woche', 'Gekocht'])
  await expect(page.getByRole('button', { name: 'Neue Spalte' })).toBeVisible()
  await expect(next(page)).toHaveCount(0)
  await expect(previous(page)).toHaveCount(0)

  await page.setViewportSize(NARROW)
  await expect(next(page)).toBeVisible()
  await page.setViewportSize(WIDE)
  await expect(next(page)).toHaveCount(0)

  // A Column added elsewhere, here after the next sync.
  expect((await page.request.post(`/api/boards/${await landingBoardId(page)}/columns`, { data: { name: 'Wochenende' } })).ok()).toBe(true)
  await expect(page.getByRole('region', { name: 'Wochenende' })).toBeVisible({ timeout: 10_000 })
  await expect(next(page)).toBeVisible()
  await expect(previous(page)).toHaveCount(0)
})

test('a Column added from the add lane stays in view, with the indicator back to the Columns before it', async ({ page }) => {
  await page.setViewportSize(WIDE)
  await openBoard(page, ['Ideen', 'Diese Woche', 'Gekocht'])

  await page.getByRole('button', { name: 'Neue Spalte' }).click()
  await page.getByRole('textbox', { name: 'Neue Spalte' }).fill('Wochenende')
  await page.getByRole('textbox', { name: 'Neue Spalte' }).press('Enter')

  await expect(page.getByRole('region', { name: 'Wochenende' })).toBeInViewport()
  await expect(previous(page)).toBeVisible()
  await expect(next(page)).toHaveCount(0)
})

test('at phone width there are no indicators, and the Column tabs are there as before', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openBoard(page)

  await expect(page.getByRole('navigation', { name: 'Spalten' }).getByRole('button')).toHaveCount(5)
  await expect(next(page)).toHaveCount(0)
  await expect(previous(page)).toHaveCount(0)
})

test('with the keyboard: Enter steps a Column, and at the last one focus moves to the other indicator', async ({ page }) => {
  await openBoard(page)

  await next(page).focus()
  await page.keyboard.press('Enter')
  await expectScrolledTo(page, STEP)
  await expect(next(page)).toBeFocused()

  await page.keyboard.press('Enter')
  await expectScrolledTo(page, 2 * STEP)
  await page.keyboard.press('Enter')
  await expect(next(page)).toHaveCount(0)
  await expect(previous(page)).toBeFocused()
})

// Clicks the right indicator and says how far the Columns have scrolled
// before anything else can happen.
function scrolledRightAfterClick(page: Page) {
  return next(page).evaluate((button: HTMLButtonElement) => {
    button.click()
    return document.querySelector('[data-testid="columns"]')!.scrollLeft
  })
}

test('the step glides, and with reduced motion it jumps', async ({ page }) => {
  await openBoard(page)
  expect(await scrolledRightAfterClick(page)).toBe(0)
  await expectScrolledTo(page, STEP)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await scrolledRightAfterClick(page)).toBe(2 * STEP)
})

for (const scheme of ['light', 'dark'] as const) {
  test(`the indicators look like a card and leave the Dishes beside them free (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await signIn(page, LYNN)
    await resetBoard(page)
    await setColumns(page, FIVE)
    for (const column of [1, 2]) await seedDish(page, { title: `Eintopf ${column}`, sourceLink: `https://kochblog.example/rezept/${column}`, sourceKind: 'blog', column })
    await gotoHydrated(page, '/')

    await next(page).click()
    await expectScrolledTo(page, STEP)

    // "Diese Woche" has snapped to the left edge, "Wochenende" is beside it.
    const card = page.getByRole('link', { name: 'Eintopf 1', exact: true })
    const cardBox = (await card.boundingBox())!
    const left = (await previous(page).boundingBox())!
    const right = (await next(page).boundingBox())!
    const board = (await page.getByTestId('columns').boundingBox())!
    expect(left.x).toBe(board.x)
    expect(left.x + left.width).toBeLessThanOrEqual(cardBox.x)
    expect(right.x + right.width).toBe(board.x + board.width)
    const surface = await card.locator('article').evaluate(el => getComputedStyle(el).backgroundColor)
    expect(surface).toBe(scheme === 'dark' ? 'rgb(30, 28, 26)' : 'rgb(255, 255, 255)')
    for (const indicator of [previous(page), next(page)]) {
      expect(await indicator.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(surface)
      expect(await indicator.evaluate(el => getComputedStyle(el).cursor)).toBe('pointer')
    }

    // Between the indicators, the Board is what the mouse reaches: a Dish
    // right under the edge opens.
    await page.mouse.click(cardBox.x + 4, cardBox.y + cardBox.height / 2)
    await expect(page.getByRole('dialog', { name: 'Eintopf 1' })).toBeVisible()
  })
}
