import type { Locator, Page } from '@playwright/test'
import { de } from '../../app/strings/de'

// The Gekocht celebration in the browser tests: veggie confetti falling over
// the Board, and Topfbert popping up behind the Gekocht toast with one of his
// cheers ("Mmh!", "Lecker!", …). Both are decoration (aria-hidden), so
// they're found by their data attributes.

export function confetti(scope: Page | Locator) {
  return scope.locator('[data-confetti-piece]')
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
