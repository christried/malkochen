import type { Locator } from '@playwright/test'
import { expect } from './fixtures'

// Cards and panels have the Dish cards' shape (--radius-card): all four
// corners rounded, slightly unevenly (#105, #130). None is rounded at the
// top only. The phone sheet on the bottom edge is the one exception.
export async function expectCardShape(card: Locator) {
  const cardShape = await card.page().evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--radius-card').trim())
  expect(cardShape.split(/\s+/)).toHaveLength(4)
  expect(cardShape).not.toMatch(/(^|\s)0(px)?(\s|$)/)
  await expect(card).toHaveCSS('border-radius', cardShape)
}
