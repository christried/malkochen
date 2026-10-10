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

interface SeenCelebration {
  // The most confetti pieces ever out at once.
  confetti: number
  // Topfbert's cheers, each new one as it came.
  cheers: string[]
}

// Records, in the page, the celebrations as they go by. The confetti is
// gone 1.6s after it bursts and the pill 2.4s after it comes: where a test
// can't look at once (a dropped card first flies to where it lands), it asks
// this instead.
export async function recordCelebrations(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { celebrations: SeenCelebration }
    const seen: SeenCelebration = w.celebrations = { confetti: 0, cheers: [] }
    new MutationObserver(() => {
      seen.confetti = Math.max(seen.confetti, document.querySelectorAll('[data-confetti-piece]').length)
      const cheer = document.querySelector('[data-topfbert] [data-cheer]')?.textContent?.trim()
      if (cheer && seen.cheers.at(-1) !== cheer) seen.cheers.push(cheer)
    }).observe(document, { childList: true, subtree: true, characterData: true })
  })
  return () => page.evaluate(() => (window as unknown as { celebrations: SeenCelebration }).celebrations)
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
