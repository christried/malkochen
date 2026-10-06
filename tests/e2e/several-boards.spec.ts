import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column, titles } from './board'
import { expectCardShape } from './card-shape'
import { ANY_CHEER, cheer, confetti, confettiOrigin, gekochtPill } from './celebration'
import { gotoHydrated } from './hydration'
import { clickAndExpectSaving, holdRequests } from './loading'

// Several Boards (PRD stories 12, 39, 46, 61): the Board switcher, "Neues
// Board", and moving a Dish to another Board. Annie is used by this file
// only; each test makes the Boards it needs.

// The switcher: the Board's name at the top, which opens the list.
function switcher(page: Page) {
  return page.getByRole('heading', { level: 1 }).getByRole('button')
}
function boardList(page: Page) {
  return page.getByRole('navigation', { name: 'Deine Boards' })
}

// A Board made through the API, as another visit would have.
async function createBoard(page: Page, name: string, emoji: string): Promise<string> {
  const res = await page.request.post('/api/boards', { data: { name, emoji } })
  expect(res.status()).toBe(201)
  return (await res.json()).id
}

test('a Member creates a Board from the switcher, switches between Boards, and the app reopens the last one', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[9])
  const home = await createBoard(page, 'Daheim', '🌱')
  await gotoHydrated(page, `/b/${home}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')

  await switcher(page).click()
  await boardList(page).getByRole('button', { name: 'Neues Board' }).click()
  const sheet = page.getByRole('dialog', { name: 'Neues Board' })
  await expect(sheet.getByLabel('Name')).toHaveAttribute('placeholder', /^z\. B\. „.+“$/)
  await sheet.getByLabel('Name').fill('Kochclub')
  await sheet.getByRole('radio', { name: '🥟' }).click()
  const release = await holdRequests(page, 'POST', /\/api\/boards$/)
  await clickAndExpectSaving(sheet.locator('button[type="submit"]'), 'Erstellt …')
  release()

  // The new Board celebrates first (achievements.spec.ts).
  await page.getByRole('dialog', { name: '🥟 Kochclub ist bereit' }).getByRole('button', { name: 'Los geht’s' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🥟 Kochclub')
  await expect(page.getByRole('navigation', { name: 'Spalten' }).getByRole('button')).toHaveText([/Ideen/, /Diese Woche/, /Gekocht/])

  await switcher(page).click()
  const links = boardList(page).getByRole('link')
  await expect(links.filter({ hasText: 'Kochclub' })).toHaveAttribute('aria-current', 'page')
  await links.filter({ hasText: 'Daheim' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')
  await expect(boardList(page)).toHaveCount(0)

  // A new visit opens the Board used last.
  await gotoHydrated(page, '/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')
})

test('a Dish moved to another Board from its detail leaves this one and keeps its Cooking History', async ({ page }) => {
  await signIn(page, ALLOWLISTED[9])
  const from = await createBoard(page, 'Zuhause', '🏡')
  const to = await createBoard(page, 'WG-Küche', '🍲')
  const res = await page.request.post(`/api/boards/${from}/dishes`, { data: { title: 'Linsen-Dal', placeholder: 'bowl' } })
  const { id: dishId } = await res.json()
  await page.request.post(`/api/dishes/${dishId}/cook`)
  await gotoHydrated(page, `/b/${from}/d/${dishId}`)

  const detail = page.getByRole('dialog', { name: 'Linsen-Dal' })
  await detail.getByRole('button', { name: 'Verschieben nach…' }).click()
  const picker = page.getByRole('dialog', { name: 'Verschieben nach…' })
  await picker.getByRole('region', { name: 'WG-Küche' }).getByRole('button', { name: 'Diese Woche' }).click()

  await expect(detail).toHaveCount(0)
  await expect(page.getByText('„Linsen-Dal“ ist jetzt in 🍲 WG-Küche · Diese Woche')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Linsen-Dal' })).toHaveCount(0)

  await gotoHydrated(page, `/b/${to}`)
  await expect(titles(page, 'Diese Woche')).toHaveText(['Linsen-Dal'])
  await expect(column(page, 'Diese Woche')).toContainText('1× gekocht')
})

test('the card’s menu moves a Dish to a Column on another Board', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, ALLOWLISTED[9])
  const from = await createBoard(page, 'Büro', '🥪')
  const to = await createBoard(page, 'Party', '🎉')
  await page.request.post(`/api/boards/${from}/dishes`, { data: { title: 'Focaccia', placeholder: 'bread' } })
  await gotoHydrated(page, `/b/${from}`)

  await page.getByRole('button', { name: 'Mehr zu „Focaccia“' }).click()
  await page.getByRole('button', { name: 'Verschieben nach…' }).click()
  const menu = page.getByRole('dialog', { name: 'Focaccia' })
  // This Board's other Columns first, then the other Boards.
  await expect(menu.getByText('Dieses Board')).toBeVisible()
  await menu.getByRole('region', { name: 'Party' }).getByRole('button', { name: 'Ideen' }).click()

  await expect(titles(page, 'Ideen')).toHaveCount(0)
  await gotoHydrated(page, `/b/${to}`)
  await expect(titles(page, 'Ideen')).toHaveText(['Focaccia'])
})

// #129: "Verschieben nach…" into another Board's Gekocht Column records a
// Cooking there, and celebrates as cooking here does (#105): the pill at
// the top names that Board, the confetti bursts from it, and the Gekocht
// toast at the bottom offers "Notiz hinzufügen" and "Rückgängig".
function gekochtToast(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Gekocht ✓' })
}

test('a Dish moved into another Board’s Gekocht Column celebrates, naming that Board; undo brings it back where it was', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, ALLOWLISTED[9])
  const from = await createBoard(page, 'Wohnung', '🏠')
  const to = await createBoard(page, 'Familie', '🍲')
  for (const title of ['Gnocchi', 'Shakshuka', 'Pho']) {
    await page.request.post(`/api/boards/${from}/dishes`, { data: { title, placeholder: 'bowl' } })
  }
  await gotoHydrated(page, `/b/${from}`)
  await expect(titles(page, 'Ideen')).toHaveText(['Pho', 'Shakshuka', 'Gnocchi'])

  await page.getByRole('button', { name: 'Mehr zu „Shakshuka“' }).click()
  await page.getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByRole('dialog', { name: 'Shakshuka' }).getByRole('region', { name: 'Familie' }).getByRole('button', { name: 'Gekocht' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Pho', 'Gnocchi'])
  await expect(confetti(page)).toHaveCount(14)
  const pill = gekochtPill(page)
  await expect(pill.locator('p')).toHaveText('Gekocht ✓in 🍲 Familie')
  await expect(cheer(pill)).toHaveText(ANY_CHEER)
  // The confetti bursts from the pill's place, at the top in the middle.
  const { width, height } = page.viewportSize()!
  const origin = await confettiOrigin(page)
  expect(Math.abs(origin.x - width / 2)).toBeLessThan(2)
  expect(origin.y).toBeLessThan(height / 8)
  expect((await pill.boundingBox())!.y).toBeLessThan(height / 8)
  const toast = gekochtToast(page)
  await expect(toast.getByRole('button', { name: 'Notiz hinzufügen' })).toBeVisible()
  // Screen readers hear the Board from the toast: the pill is decoration.
  await expect(toast).toContainText('Gekocht ✓ in 🍲 Familie')
  await expect(page.getByText(/ist jetzt in/)).toHaveCount(0)

  await toast.getByRole('button', { name: 'Rückgängig' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Pho', 'Shakshuka', 'Gnocchi'])
  await expect(page.getByRole('link', { name: 'Shakshuka' })).toBeFocused()
  await expect(page.getByText('1× gekocht')).toHaveCount(0)
  await gotoHydrated(page, `/b/${from}`)
  await expect(titles(page, 'Ideen')).toHaveText(['Pho', 'Shakshuka', 'Gnocchi'])
  await expect(page.getByText('1× gekocht')).toHaveCount(0)
  await gotoHydrated(page, `/b/${to}`)
  await expect(page.getByRole('link', { name: 'Shakshuka' })).toHaveCount(0)
})

test('a Dish moved into another Board’s Gekocht Column from its detail celebrates over the Board once the detail has closed; a note from the toast goes with it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[9])
  const from = await createBoard(page, 'Studio', '🎨')
  const to = await createBoard(page, 'Oma', '🍰')
  const res = await page.request.post(`/api/boards/${from}/dishes`, { data: { title: 'Kaiserschmarrn', placeholder: 'bowl' } })
  const { id: dishId } = await res.json()
  await gotoHydrated(page, `/b/${from}/d/${dishId}`)

  const detail = page.getByRole('dialog', { name: 'Kaiserschmarrn' })
  await detail.getByRole('button', { name: 'Verschieben nach…' }).click()
  const picker = page.getByRole('dialog', { name: 'Verschieben nach…' })
  await picker.getByRole('region', { name: 'Oma' }).getByRole('button', { name: 'Gekocht' }).click()

  await expect(detail).toHaveCount(0)
  const pill = gekochtPill(page)
  await expect(pill.locator('p')).toHaveText('Gekocht ✓in 🍰 Oma')
  await expect(confetti(page)).toHaveCount(14)
  // Over the Board: the detail's own pill and toast went with it.
  await expect(pill).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Kaiserschmarrn' })).toHaveCount(0)

  await gekochtToast(page).getByRole('button', { name: 'Notiz hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Notiz zum Kochen' })
  await sheet.getByLabel('Notiz').fill('mit Apfelmus')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(sheet).toBeHidden()

  await gotoHydrated(page, `/b/${to}/d/${dishId}`)
  const moved = page.getByRole('dialog', { name: 'Kaiserschmarrn' })
  await expect(moved.locator('[data-cooking]')).toHaveCount(1)
  await expect(moved.locator('[data-cooking]')).toContainText('mit Apfelmus')
})

// Opening another Board (handoff "Skeleton shimmer"): its chrome shows at
// once, with skeleton cards in its Columns while its Dishes load.
function skeleton(page: Page) {
  return page.locator('[data-board-skeleton]')
}
// Where an element sits in the page's layout and how high it is, leaving out
// transforms such as the cards' rise.
function layoutBox(element: Locator) {
  return element.evaluate((el) => {
    let top = 0
    for (let at = el as HTMLElement | null; at; at = at.offsetParent as HTMLElement | null) top += at.offsetTop
    return { top, height: (el as HTMLElement).offsetHeight }
  })
}
// The animations running in an element and its pseudo-elements, by their
// timing.
function animations(element: Locator) {
  return element.evaluate(el => el.getAnimations({ subtree: true }).map((a) => {
    const timing = a.effect!.getComputedTiming()
    return { duration: timing.duration, iterations: timing.iterations, easing: (a.effect as KeyframeEffect).getKeyframes()[0]?.easing }
  }))
}
// Two Boards with a Dish each, named `fromName` and `toName`: the first one
// open, then switching to the second one, whose request is held until
// `release`.
async function switchingBoards(page: Page, fromName: string, toName: string) {
  const from = await createBoard(page, fromName, '🥗')
  const to = await createBoard(page, toName, '🌙')
  await page.request.post(`/api/boards/${from}/dishes`, { data: { title: 'Bowl', placeholder: 'bowl' } })
  await page.request.post(`/api/boards/${to}/dishes`, { data: { title: 'Ramen', placeholder: 'ramen' } })
  await gotoHydrated(page, `/b/${from}`)
  const release = await holdRequests(page, 'GET', new RegExp(`/api/boards/${to}$`))
  await switcher(page).click()
  await boardList(page).getByRole('link').filter({ hasText: toName }).click()
  return release
}

test('switching Boards shows the new Board’s skeleton at once, shimmering, and its Dishes take the skeleton cards’ place', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await signIn(page, ALLOWLISTED[9])
  const release = await switchingBoards(page, 'Mittags', 'Abends')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌙 Abends')
  await expect(page.getByRole('link', { name: 'Bowl' })).toHaveCount(0)
  await expect(skeleton(page)).toHaveAttribute('aria-busy', 'true')
  // Phones: the first Column's headline, the tabs, and that Column only.
  await expect(page.getByRole('navigation', { name: 'Spalten' }).getByRole('button')).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
  await expect(skeleton(page).getByRole('heading', { level: 2 })).toHaveText(['Ideen'])
  await expect(skeleton(page).getByRole('region')).toHaveCount(1)
  await expectCardShape(skeleton(page).getByRole('region'))
  const card = skeleton(page).locator('[data-skeleton-card]').first()
  await expect(card).toBeVisible()
  expect(await animations(card)).toEqual([{ duration: 1400, iterations: Infinity, easing: 'ease-in-out' }])
  // A DishCard's size: 128px high, an 86px thumb.
  const placeholder = await layoutBox(card)
  expect(placeholder.height).toBe(128)
  expect(await card.locator('[data-thumb]').evaluate(el => (el as HTMLElement).offsetWidth)).toBe(86)

  release()
  const dish = column(page, 'Ideen').locator('li', { has: page.getByRole('link', { name: 'Ramen' }) })
  await expect(dish).toBeVisible()
  await expect(skeleton(page)).toHaveCount(0)
  expect(await layoutBox(dish)).toEqual(placeholder)
})

test('with reduced motion the skeleton is still, at 60% opacity, in every Column side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page, ALLOWLISTED[9])
  const release = await switchingBoards(page, 'Brunch', 'Picknick')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌙 Picknick')
  await expect(skeleton(page).getByRole('region').getByRole('heading', { level: 2 })).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
  await expect(skeleton(page).getByRole('region').locator('[data-column-subtitle]')).toHaveText(['Worauf hast du Lust?', 'Das steht an.', 'Schon geschafft!'])
  await expect(skeleton(page).locator('[data-skeleton-cards]')).toHaveCount(3)
  await expect(skeleton(page).locator('[data-skeleton-cards]').first()).toHaveCSS('opacity', '0.6')
  expect(await animations(skeleton(page))).toEqual([])
  // The lane headers are the Board's, so its Dishes take the cards' place.
  const placeholder = await layoutBox(skeleton(page).locator('[data-skeleton-card]').first())

  release()
  const dish = column(page, 'Ideen').locator('li', { has: page.getByRole('link', { name: 'Ramen' }) })
  await expect(dish).toBeVisible()
  await expect(skeleton(page)).toHaveCount(0)
  expect(await layoutBox(dish)).toEqual(placeholder)
})
