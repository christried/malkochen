import type { Locator, Page } from '@playwright/test'

// Finding a Board's parts the way a user sees them.

export function column(page: Page, name: string) {
  return page.getByRole('region', { name })
}

// The titles of a Column's Dishes, top to bottom.
export function titles(page: Page, name: string) {
  return column(page, name).getByRole('heading', { level: 3 })
}

// A Column tab on phones, by its name and Dish count, e.g. "Ideen 2".
export function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Spalten' }).getByRole('button', { name })
}

// Once a card (or anything in it) has risen into its place on the Board.
export async function cardAtRest(inCard: Locator) {
  await inCard.evaluate(el => Promise.all((el.closest('li') ?? el).getAnimations().map(a => a.finished)))
}
