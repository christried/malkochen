import { randomUUID } from 'node:crypto'
import type { Locator, Page } from '@playwright/test'
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
