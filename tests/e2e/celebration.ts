import type { Locator, Page } from '@playwright/test'

// The Gekocht celebration in the browser tests: veggie confetti falling over
// the Board, and Topfbert popping up behind the Gekocht toast with "Mmh!".
// Both are decoration (aria-hidden), so they're found by their data
// attributes.

export function confetti(scope: Page | Locator) {
  return scope.locator('[data-confetti-piece]')
}

export function topfbert(scope: Page | Locator) {
  return scope.locator('[data-topfbert]')
}
