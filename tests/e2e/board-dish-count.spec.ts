import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column, titles } from './board'
import { gotoHydrated } from './hydration'
import { removeUsers } from './seed'

// The Board Dish count (#211): „· N“ after the Board's name in the header
// and on each Board in the switcher, kept current as Dishes come and go. Tu
// is used by this file only; each test makes the Boards it needs, from none.
const TU = ALLOWLISTED[46]
test.beforeEach(() => removeUsers(TU))

async function createBoard(page: Page, name: string, emoji: string): Promise<string> {
  const res = await page.request.post('/api/boards', { data: { name, emoji } })
  expect(res.status()).toBe(201)
  return (await res.json()).id
}

async function addDish(page: Page, boardId: string, title: string): Promise<string> {
  const res = await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title, placeholder: 'bowl' } })
  expect(res.status()).toBe(201)
  return (await res.json()).id
}

function pill(page: Page) {
  return page.getByRole('heading', { level: 1 }).getByRole('button')
}

// The count the pill shows after the Board's name. It is drawn by CSS
// (::before), so the heading's text stays the name alone.
function headerCount(page: Page) {
  return pill(page).locator('.dish-count')
}

function boardRow(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Deine Boards' }).getByRole('link').filter({ hasText: name })
}

test('the header and the switcher show each Board’s Dish count, the Gekocht Column’s included', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, TU)
  const home = await createBoard(page, 'Daheim', '🌱')
  const empty = await createBoard(page, 'Leer', '🫙')
  await addDish(page, home, 'Linsen-Dal')
  const cooked = await addDish(page, home, 'Focaccia')
  await page.request.post(`/api/dishes/${cooked}/cook`)
  await gotoHydrated(page, `/b/${home}`)

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')
  await expect(headerCount(page)).toHaveAttribute('data-dish-count', '· 2')
  expect(await headerCount(page).evaluate(el => getComputedStyle(el, '::before').content)).toBe('"· 2"')
  await expect(pill(page)).toHaveAccessibleName('Board wechseln, jetzt: Daheim, 2 Gerichte')

  await pill(page).click()
  await expect(boardRow(page, 'Daheim')).toContainText('Daheim· 2')
  await expect(boardRow(page, 'Leer')).toContainText('Leer· 0')

  await gotoHydrated(page, `/b/${empty}`)
  await expect(headerCount(page)).toHaveAttribute('data-dish-count', '· 0')
})

test('the count follows adds and deletes, from this Member or another, and moves only when a Dish leaves the Board', async ({ page }) => {
  // Waits for a poll (up to 5s apart).
  test.slow()
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, TU)
  const from = await createBoard(page, 'Büro', '🥪')
  await createBoard(page, 'Party', '🎉')
  for (const title of ['Focaccia', 'Pad Thai', 'Chili']) await addDish(page, from, title)
  await gotoHydrated(page, `/b/${from}`)
  await expect(headerCount(page)).toHaveAttribute('data-dish-count', '· 3')

  // Added elsewhere (as another Member would): the poll brings it.
  await addDish(page, from, 'Ramen')
  await expect(headerCount(page)).toHaveAttribute('data-dish-count', '· 4', { timeout: 10_000 })

  await page.getByRole('button', { name: 'Mehr zu „Chili“' }).click()
  await page.getByRole('dialog', { name: 'Chili' }).getByRole('button', { name: 'Archivieren' }).click()
  await expect(headerCount(page)).toHaveAttribute('data-dish-count', '· 3')

  // Into another Column and into Gekocht: still on the Board.
  await page.getByRole('button', { name: 'Mehr zu „Pad Thai“' }).click()
  await page.getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Diese Woche' }).first().click()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Pad Thai'])
  await column(page, 'Diese Woche').getByRole('button', { name: 'Gekocht ✓: „Pad Thai“' }).click()
  await expect(titles(page, 'Gekocht')).toHaveText(['Pad Thai'])
  await expect(headerCount(page)).toHaveAttribute('data-dish-count', '· 3')

  // To another Board: one fewer here, one more there.
  await page.getByRole('button', { name: 'Mehr zu „Focaccia“' }).click()
  await page.getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByRole('dialog', { name: 'Focaccia' }).getByRole('region', { name: 'Party' }).getByRole('button', { name: 'Ideen' }).click()
  await expect(headerCount(page)).toHaveAttribute('data-dish-count', '· 2')
  await pill(page).click()
  await expect(boardRow(page, 'Büro')).toContainText('Büro· 2')
  await expect(boardRow(page, 'Party')).toContainText('Party· 1')
})

// Each desktop lane's count (#280): „· N“ after the Column's name, drawn by
// CSS like the header's, so the heading stays the name.
function laneCount(page: Page, name: string) {
  // Not the old number rolling away.
  return column(page, name).locator('[data-lane-count] [data-dish-count]:not([class*="-leave-"])')
}

async function expectLaneCounts(page: Page, counts: Record<string, number>) {
  for (const [name, count] of Object.entries(counts)) {
    await expect(laneCount(page, name)).toHaveAttribute('data-dish-count', `· ${count}`, { timeout: 10_000 })
  }
}

test('on desktop each lane shows its Column’s Dish count, Gekocht included, and follows adds, moves and deletes', async ({ page }) => {
  // Waits for a poll (up to 5s apart).
  test.slow()
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, TU)
  const board = await createBoard(page, 'Zuhause', '🏡')
  for (const title of ['Focaccia', 'Pad Thai']) await addDish(page, board, title)
  await page.request.post(`/api/dishes/${await addDish(page, board, 'Chili')}/cook`)
  await gotoHydrated(page, `/b/${board}`)

  await expectLaneCounts(page, { 'Ideen': 2, 'Diese Woche': 0, 'Gekocht': 1 })
  await expect(column(page, 'Ideen').getByRole('heading', { level: 2 })).toHaveText('Ideen')
  const looks = await laneCount(page, 'Ideen').evaluate(el => ({
    drawn: getComputedStyle(el, '::before').content,
    quiet: getComputedStyle(el.closest('[data-lane-count]')!).opacity,
  }))
  expect(looks).toEqual({ drawn: '"· 2"', quiet: '0.7' })

  // Added elsewhere (as another Member would): the poll brings it.
  await addDish(page, board, 'Ramen')
  await expectLaneCounts(page, { 'Ideen': 3 })

  await page.getByRole('button', { name: 'Mehr zu „Pad Thai“' }).click()
  await page.getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Diese Woche' }).first().click()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Pad Thai'])
  await expectLaneCounts(page, { 'Ideen': 2, 'Diese Woche': 1, 'Gekocht': 1 })

  await page.getByRole('button', { name: 'Mehr zu „Chili“' }).click()
  await page.getByRole('dialog', { name: 'Chili' }).getByRole('button', { name: 'Archivieren' }).click()
  await expectLaneCounts(page, { 'Ideen': 2, 'Diese Woche': 1, 'Gekocht': 0 })
})

for (const scheme of ['light', 'dark'] as const) {
  test(`on a phone a long Board name truncates and the count stays whole, quieter than the name (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, TU)
    const board = await createBoard(page, 'Unsere wunderbare Sonntagsküche mit Freunden', '🍲')
    for (const title of ['Focaccia', 'Pad Thai']) await addDish(page, board, title)
    await gotoHydrated(page, `/b/${board}`)
    await expect(headerCount(page)).toHaveAttribute('data-dish-count', '· 2')

    const looks = await pill(page).evaluate((button) => {
      const name = button.querySelector('.truncate')!
      const count = button.querySelector('.dish-count')!
      const box = (el: Element) => el.getBoundingClientRect()
      // The count as wide as it is unsqueezed, out of the pill's flow.
      const probe = count.cloneNode() as HTMLElement
      probe.style.position = 'absolute'
      button.append(probe)
      const natural = box(probe).width
      probe.remove()
      return {
        truncated: name.scrollWidth > name.clientWidth,
        countWhole: natural > 10 && Math.abs(box(count).width - natural) < 0.5 && box(count).right <= box(button.querySelector('.chevron')!).left,
        afterName: box(count).left >= box(name).right - 0.5,
        quieter: Number(getComputedStyle(count).opacity) < 1,
        fitsPage: box(button).right <= window.innerWidth,
      }
    })
    expect(looks).toEqual({ truncated: true, countWhole: true, afterName: true, quieter: true, fitsPage: true })

    await pill(page).click()
    const count = boardRow(page, 'Unsere').locator('[data-dish-count]')
    await expect(count).toHaveText('· 2')
    await expect(count).toBeInViewport({ ratio: 1 })
  })
}
