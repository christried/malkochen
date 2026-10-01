import { expect, test, type Locator, type Page } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { tab, titles } from './board'
import { confetti, topfbert } from './celebration'
import { gotoHydrated, reloadHydrated } from './hydration'
import { seedDish } from './seed'

// Dragging Dishes (PRD stories 31, 32, 34, 79): with the mouse on desktop,
// within a Column and across lanes; with a long-press on phones, within the
// Column and onto a Column tab. Katherine's Board is used by this file only.
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }

function card(page: Page, title: string) {
  return page.getByRole('link', { name: title, exact: true })
}

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}

// Letting go, the card flies to where it lands; only then has it moved.
async function landed(page: Page) {
  await expect(page.getByTestId('drag-card')).toHaveCount(0)
}

// A mouse picking a card up by its middle and letting go at `to`.
async function mouseDrag(page: Page, from: Locator, to: { x: number, y: number }) {
  const start = await center(from)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
  await landed(page)
}

// A finger long-pressing a card by its middle, dragging it to `to` and
// lifting, as touch pointer events.
async function touchDrag(page: Page, from: Locator, to: { x: number, y: number }, { hold = 450 } = {}) {
  const start = await center(from)
  const at = (clientX: number, clientY: number) => ({ pointerId: 11, pointerType: 'touch', isPrimary: true, clientX, clientY, bubbles: true })
  await from.dispatchEvent('pointerdown', at(start.x, start.y))
  await page.waitForTimeout(hold)
  // Once lifted, the card's own place is only a slot: the Board gets the rest.
  const board = page.getByTestId('columns')
  for (let step = 1; step <= 10; step++) {
    await board.dispatchEvent('pointermove', at(start.x + (to.x - start.x) * step / 10, start.y + (to.y - start.y) * step / 10))
    await page.waitForTimeout(16)
  }
  await board.dispatchEvent('pointerup', at(to.x, to.y))
  await landed(page)
}

test('desktop: a Dish dragged within its Column stays where it was dropped', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, ALLOWLISTED[5])
  for (const title of ['Bowl', 'Kürbissuppe']) await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  for (const title of ['Curry', 'Ramen', 'Tacos']) await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Ramen', 'Curry'])

  // Tacos, from the top to below Curry.
  const curry = await center(card(page, 'Curry'))
  await mouseDrag(page, card(page, 'Tacos'), { x: curry.x, y: curry.y + curry.box.height * 0.4 })

  await expect(titles(page, 'Ideen')).toHaveText(['Ramen', 'Curry', 'Tacos'])
  // Dropping doesn't open the Dish.
  await expect(page).toHaveURL(/\/b\/[^/]+$/)
  await reloadHydrated(page)
  await expect(titles(page, 'Ideen')).toHaveText(['Ramen', 'Curry', 'Tacos'])
})

test('desktop: a Dish dragged across lanes lands where it was dropped', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')
  await expect(titles(page, 'Diese Woche')).toHaveText(['Kürbissuppe', 'Bowl'])

  // Curry, to between Kürbissuppe and Bowl.
  const bowl = await center(card(page, 'Bowl'))
  await mouseDrag(page, card(page, 'Curry'), { x: bowl.x, y: bowl.box.y + 10 })

  await expect(titles(page, 'Diese Woche')).toHaveText(['Kürbissuppe', 'Curry', 'Bowl'])
  await expect(titles(page, 'Ideen')).toHaveText(['Ramen', 'Tacos'])
  await reloadHydrated(page)
  await expect(titles(page, 'Diese Woche')).toHaveText(['Kürbissuppe', 'Curry', 'Bowl'])
  await expect(titles(page, 'Ideen')).toHaveText(['Ramen', 'Tacos'])
})

test('desktop: a click without dragging still opens the Dish', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')

  await card(page, 'Ramen').click()

  await expect(page.getByRole('dialog', { name: 'Ramen' })).toBeVisible()
})

test('phone: a long-pressed Dish can be dragged within its Column', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')
  await expect(titles(page, 'Ideen')).toHaveText(['Ramen', 'Tacos'])

  const tacos = await center(card(page, 'Tacos'))
  await touchDrag(page, card(page, 'Ramen'), { x: tacos.x, y: tacos.y + tacos.box.height * 0.4 })

  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Ramen'])
  await expect(page).toHaveURL(/\/b\/[^/]+$/)
  await reloadHydrated(page)
  await expect(titles(page, 'Ideen')).toHaveText(['Tacos', 'Ramen'])
})

test('phone: a Dish dropped on a Column tab goes to the top of that Column', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')
  await expect(tab(page, 'Diese Woche 3')).toBeVisible()

  await touchDrag(page, card(page, 'Tacos'), await center(tab(page, 'Diese Woche 3')))

  await expect(tab(page, 'Diese Woche 4')).toBeVisible()
  await expect(tab(page, 'Ideen 1')).toHaveAttribute('aria-pressed', 'true')
  await expect(titles(page, 'Ideen')).toHaveText(['Ramen'])
  await reloadHydrated(page)
  await tab(page, 'Diese Woche 4').click()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Tacos', 'Kürbissuppe', 'Curry', 'Bowl'])
})

test('phone: a Dish dropped on its own Column’s tab goes to the top', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')
  await tab(page, 'Diese Woche 4').click()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Tacos', 'Kürbissuppe', 'Curry', 'Bowl'])

  await touchDrag(page, card(page, 'Bowl'), await center(tab(page, 'Diese Woche 4')))

  await expect(titles(page, 'Diese Woche')).toHaveText(['Bowl', 'Tacos', 'Kürbissuppe', 'Curry'])
  await reloadHydrated(page)
  await tab(page, 'Diese Woche 4').click()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Bowl', 'Tacos', 'Kürbissuppe', 'Curry'])
})

test('phone: a Dish let go above the tabs stays in its Column', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')
  await expect(tab(page, 'Ideen 1')).toHaveAttribute('aria-pressed', 'true')
  const heading = await center(page.getByRole('heading', { level: 1 }))
  const tabBar = await center(page.getByRole('navigation', { name: 'Spalten' }))

  // The header sits right above the tab to the right of the active one.
  await touchDrag(page, card(page, 'Ramen'), { x: tabBar.box.x + tabBar.box.width / 2, y: heading.y })

  await expect(titles(page, 'Ideen')).toHaveText(['Ramen'])
  await expect(tab(page, 'Ideen 1')).toBeVisible()
  await expect(tab(page, 'Diese Woche 4')).toBeVisible()
})

test('phone: a finger that moves before the long-press swipes instead of dragging', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')
  await expect(tab(page, 'Ideen 1')).toHaveAttribute('aria-pressed', 'true')

  const ramen = await center(card(page, 'Ramen'))
  await touchDrag(page, card(page, 'Ramen'), { x: ramen.x - 180, y: ramen.y }, { hold: 0 })

  await expect(tab(page, 'Diese Woche 4')).toHaveAttribute('aria-pressed', 'true')
  await expect(tab(page, 'Ideen 1')).toBeVisible()
})

test('a failed drop puts the card back and says so', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')
  await page.route('**/api/dishes/*/move', route => route.fulfill({ status: 500 }))
  await expect(titles(page, 'Diese Woche')).toHaveText(['Bowl', 'Tacos', 'Kürbissuppe', 'Curry'])

  const tacos = await center(card(page, 'Tacos'))
  await mouseDrag(page, card(page, 'Bowl'), { x: tacos.x, y: tacos.y + tacos.box.height * 0.4 })

  await expect(page.locator('[data-toast]')).toHaveText('„Bowl“ ließ sich nicht verschieben. Versuch es gleich noch mal.')
  await expect(titles(page, 'Diese Woche')).toHaveText(['Bowl', 'Tacos', 'Kürbissuppe', 'Curry'])
})

test('phone: a Dish dropped on the Gekocht tab is cooked, and that celebrates', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')

  await touchDrag(page, card(page, 'Ramen'), await center(tab(page, 'Gekocht 0')))

  await expect(tab(page, 'Gekocht 1')).toBeVisible()
  await expect(confetti(page)).toHaveCount(14)
  await expect(topfbert(page)).toContainText('Mmh!')
})

test('desktop: a Dish dropped in the Gekocht Column is cooked, and that celebrates', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, ALLOWLISTED[5])
  await gotoHydrated(page, '/')

  const ramen = await center(card(page, 'Ramen'))
  await mouseDrag(page, card(page, 'Bowl'), { x: ramen.x, y: ramen.box.y + ramen.box.height + 40 })

  await expect(titles(page, 'Gekocht')).toHaveText(['Ramen', 'Bowl'])
  await expect(confetti(page)).toHaveCount(14)
  await expect(topfbert(page)).toContainText('Mmh!')
})
