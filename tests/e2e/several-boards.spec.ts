import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column, titles } from './board'
import { gotoHydrated } from './hydration'
import { expectSaving, holdRequests, layoutWidth } from './saving'

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
  await sheet.getByLabel('Name').fill('Kochclub')
  await sheet.getByRole('radio', { name: '🥟' }).click()
  const release = await holdRequests(page, 'POST', /\/api\/boards$/)
  const create = sheet.locator('button[type="submit"]')
  const width = await layoutWidth(create)
  await create.click()
  await expectSaving(create, 'Erstellt …', width)
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
  const res = await page.request.post(`/api/boards/${from}/dishes`, { data: { title: 'Linsen-Dal', placeholder: 'curry' } })
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
