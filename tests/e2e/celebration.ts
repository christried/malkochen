import type { Locator, Page } from '@playwright/test'
import { de } from '../../app/strings/de'

// The Gekocht celebration in the browser tests: veggie confetti falling over
// the Board, and the pill at the top of the screen with Topfbert popping up
// in it, saying one of his cheers ("Mmh!", "Lecker!", …), while the Gekocht
// toast at the bottom offers its actions. All of it but the toast is
// decoration (aria-hidden), so it's found by its data attributes.

export function confetti(scope: Page | Locator) {
  return scope.locator('[data-confetti-piece]')
}

// Where the first confetti piece bursts from.
export async function confettiOrigin(scope: Page | Locator) {
  return confetti(scope).first().evaluate(el => ({ x: Number.parseFloat((el as HTMLElement).style.left), y: Number.parseFloat((el as HTMLElement).style.top) }))
}

// The pill at the top: "Gekocht ✓", and the other Board's name for a Dish
// moved into its Gekocht Column.
export function gekochtPill(scope: Page | Locator) {
  return scope.locator('[data-gekocht-pill]')
}

export function topfbert(scope: Page | Locator) {
  return scope.locator('[data-topfbert]')
}

// His speech bubble.
export function cheer(scope: Page | Locator) {
  return topfbert(scope).locator('[data-cheer]')
}

// Matches exactly one of his cheers (app/strings/de.ts → dish.cheers).
export const CHEERS = de.dish.cheers
export const ANY_CHEER = new RegExp(`^(${CHEERS.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`)
