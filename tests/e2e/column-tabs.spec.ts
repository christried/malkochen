import type { Locator } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column, swipe, tab, titles } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeUsers, seedDish } from './seed'

// Column tabs and swiping on phones, "Verschieben nach…" from a card's menu,
// and all Columns side by side from 768px (PRD stories 28, 33). Barbara's Board is
// used by this file only.
test.describe.configure({ mode: 'serial' })
test.beforeAll(() => removeUsers(ALLOWLISTED[4]))

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const PHONE = { width: 390, height: 844 }

async function swipeDown(board: Locator) {
  const box = (await board.boundingBox())!
  const at = (clientX: number, clientY: number) => ({ pointerId: 8, pointerType: 'touch', isPrimary: true, clientX, clientY, bubbles: true })
  await board.dispatchEvent('pointerdown', at(box.x + 100, box.y + 40))
  await board.dispatchEvent('pointermove', at(box.x + 130, box.y + 120))
  await board.dispatchEvent('pointerup', at(box.x + 160, box.y + 200))
}

test('phones show one Column at a time, switched by its tab or by swiping', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[4])
  await seedDish(page, { title: 'Kürbissuppe', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  for (const title of ['Ramen', 'Tacos']) await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  await expect(tab(page, 'Ideen 2')).toHaveAttribute('aria-pressed', 'true')
  await expect(tab(page, 'Diese Woche 1')).toBeVisible()
  await expect(tab(page, 'Gekocht 0')).toBeVisible()
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Ramen'])
  await expect(column(page, 'Diese Woche')).toBeHidden()

  await tab(page, 'Diese Woche 1').click()

  await expect(titles(page, 'Diese Woche')).toHaveText(['Kürbissuppe'])
  await expect(column(page, 'Ideen')).toBeHidden()
  await expect(tab(page, 'Diese Woche 1')).toHaveAttribute('aria-pressed', 'true')

  const board = page.getByTestId('columns')
  await swipe(board, -160)
  await expect(tab(page, 'Gekocht 0')).toHaveAttribute('aria-pressed', 'true')
  await expect(column(page, 'Gekocht')).toBeVisible()
  await expect(column(page, 'Diese Woche')).toBeHidden()

  // Past the last Column there is nowhere to go.
  await swipe(board, -160)
  await expect(tab(page, 'Gekocht 0')).toHaveAttribute('aria-pressed', 'true')

  await swipe(board, 160)
  await swipe(board, 160)
  await expect(tab(page, 'Ideen 2')).toHaveAttribute('aria-pressed', 'true')
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Ramen'])

  // A short, slow swipe springs back; the same distance flicked pages.
  await swipe(board, -30, { slow: true })
  await expect(tab(page, 'Ideen 2')).toHaveAttribute('aria-pressed', 'true')
  await swipe(board, -30)
  await expect(tab(page, 'Diese Woche 1')).toHaveAttribute('aria-pressed', 'true')
  // Swiping down the Column is scrolling, not switching.
  await swipeDown(board)
  await expect(tab(page, 'Diese Woche 1')).toHaveAttribute('aria-pressed', 'true')
  await tab(page, 'Ideen 2').click()
  await expect(tab(page, 'Ideen 2')).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/\/b\/[^/]+$/)
})

test('"Verschieben nach…" moves a Dish to the top of another Column', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[4])
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Mehr zu „Ramen“' }).click()
  const menu = page.getByRole('dialog', { name: 'Ramen' })
  await menu.getByRole('button', { name: 'Verschieben nach…' }).click()

  await expect(menu.getByRole('button', { name: 'Ideen' })).toHaveCount(0)
  await menu.getByRole('button', { name: 'Diese Woche' }).click()

  await expect(menu).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: '„Ramen“ nach „Diese Woche“ verschoben' })).toBeVisible()
  // The phone stays on the Column it was on.
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos'])
  await expect(tab(page, 'Ideen 1')).toHaveAttribute('aria-pressed', 'true')
  await expect(tab(page, 'Diese Woche 2')).toBeVisible()

  await reloadHydrated(page)
  await tab(page, 'Diese Woche 2').click()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Ramen', 'Kürbissuppe'])
})

test('the menu goes back from choosing a Column', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[4])
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Mehr zu „Tacos“' }).click()
  const menu = page.getByRole('dialog', { name: 'Tacos' })
  await menu.getByRole('button', { name: 'Verschieben nach…' }).click()
  await menu.getByRole('button', { name: 'Zurück' }).click()

  await expect(menu.getByRole('button', { name: 'Archivieren' })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Diese Woche' })).toHaveCount(0)
})

test('a failed move puts the card back and says so; one already deleted just goes', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[4])
  await gotoHydrated(page, '/')
  const answer = { status: 500 }
  await page.route('**/api/dishes/*/move', route => route.fulfill(answer))
  async function moveTacos() {
    await page.getByRole('button', { name: 'Mehr zu „Tacos“' }).click()
    const menu = page.getByRole('dialog', { name: 'Tacos' })
    await menu.getByRole('button', { name: 'Verschieben nach…' }).click()
    await menu.getByRole('button', { name: 'Diese Woche' }).click()
  }

  await moveTacos()

  await expect(page.locator('[data-toast]')).toHaveText('„Tacos“ ließ sich nicht verschieben. Versuch es gleich noch mal.')
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos'])
  await expect(tab(page, 'Diese Woche 2')).toBeVisible()

  // Another Member deleted it first: the server doesn't find it any more.
  answer.status = 404
  await moveTacos()

  await expect(page.locator('[data-toast]')).toContainText('„Tacos“ nach „Diese Woche“ verschoben')
  await expect(column(page, 'Ideen').getByText('Noch nichts hier.')).toBeVisible()
  await expect(tab(page, 'Diese Woche 2')).toBeVisible()
})

test('from 768px all Columns show side by side and scroll-snap', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 })
  await signIn(page, ALLOWLISTED[4])
  await gotoHydrated(page, '/')

  await expect(page.getByRole('navigation', { name: 'Spalten' })).toBeHidden()
  // A sideways touch pan here scrolls the Columns; it doesn't switch the one
  // a phone would show.
  await swipe(page.getByTestId('columns'), -300)
  for (const name of ['Ideen', 'Diese Woche', 'Gekocht']) await expect(column(page, name)).toBeVisible()
  const board = page.getByTestId('columns')
  expect(await board.evaluate(el => getComputedStyle(el).scrollSnapType)).toContain('x')
  expect(await column(page, 'Ideen').evaluate(el => getComputedStyle(el).scrollSnapAlign)).toBe('start')

  await page.setViewportSize(PHONE)
  await expect(tab(page, 'Ideen 1')).toHaveAttribute('aria-pressed', 'true')
})
