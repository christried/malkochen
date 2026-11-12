import { randomUUID } from 'node:crypto'
import type { Locator, Page } from '@playwright/test'
import pg from 'pg'
import { addDays, weekStart } from '../../app/board/week-days'
import { berlinDay } from '../../app/strings/intl'
import { expect } from './fixtures'

// The Week Plan as a user sees it, and the writes a test makes through the API.

export const today = () => berlinDay(new Date())
// The Monday of next week: a week whose days are all still to come.
export const nextMonday = () => addDays(weekStart(today()), 7)

// A new Board of the signed-in user, named `name`, with the default Columns.
export async function newBoard(page: Page, name: string): Promise<string> {
  const res = await page.request.post('/api/boards', { data: { name, emoji: '🥗' } })
  expect(res.status()).toBe(201)
  return ((await res.json()) as { id: string }).id
}

// A Dish added to the Board through the API; its id.
export async function addDish(page: Page, boardId: string, title: string): Promise<string> {
  const res = await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title, placeholder: 'bowl' } })
  expect(res.status()).toBe(201)
  return ((await res.json()) as { id: string }).id
}

// A Dish planned on a day through the API (a day, YYYY-MM-DD); the Planned
// Dish's id.
export async function planOn(page: Page, boardId: string, dishId: string, day: string): Promise<string> {
  const id = randomUUID()
  const res = await page.request.post(`/api/boards/${boardId}/planned-dishes`, { data: { id, dishId, day } })
  expect(res.status()).toBe(201)
  return id
}

// A day's list on the open Week Plan, found by its name ("Montag, 23. November").
export function dayList(page: Page, name: RegExp | string) {
  return page.getByRole('list', { name })
}

// The Planned Dishes' titles of a day, top to bottom (each is a link named
// "Titel, Wochentag").
export function plannedTitles(list: Locator) {
  return list.getByRole('link')
}

// A mouse picking a Planned Dish up by its middle and letting go at `to`.
export async function mouseDrag(page: Page, from: Locator, to: { x: number, y: number }) {
  const box = (await from.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 14 })
  await page.mouse.up()
  await expect(page.getByTestId('drag-planned')).toHaveCount(0)
}

// Who cooks a Planned Dish, set through the API (null clears it).
export async function setCook(page: Page, plannedId: string, cookId: string | null) {
  const res = await page.request.put(`/api/planned-dishes/${plannedId}/cook`, { data: { cookId } })
  expect(res.status()).toBe(200)
}

// The Board's Members, as the signed-in user reads them.
export async function boardMembers(page: Page, boardId: string): Promise<{ id: string, name: string, isYou: boolean }[]> {
  return ((await (await page.request.get(`/api/boards/${boardId}`)).json()) as { members: { id: string, name: string, isYou: boolean }[] }).members
}

// A Cooking of the Dish `daysAgo` days back, put straight into the test
// database: the UI only records one dated now.
export async function seedCookingDaysAgo(boardId: string, title: string, daysAgo: number) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `insert into cooking (dish_id, cooked_at)
       select d.id, now() - make_interval(days => $3::int) from dish d where d.board_id = $1 and d.title = $2`,
      [boardId, title, daysAgo],
    )
  }
  finally {
    await client.end()
  }
}
