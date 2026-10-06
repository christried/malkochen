import type { Locator } from '@playwright/test'
import { expect } from './fixtures'

// Cards and panels are rounded on all four corners, slightly unevenly, like
// the Dish cards (#105, #130): none is rounded at the top only. The phone
// sheet on the bottom edge is the one exception.
export const CARD_SHAPE = '28px 24px 30px 26px'

export function expectCardShape(card: Locator) {
  return expect(card).toHaveCSS('border-radius', CARD_SHAPE)
}
