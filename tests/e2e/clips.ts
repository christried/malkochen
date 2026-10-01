import type { Locator, Page } from '@playwright/test'

// Motion clips (MotionClip.vue) in the browser tests.

// The clips playing inside `scope`, by the file they play; only those under
// `dir` (e.g. '/placeholders/') if given.
export function playing(scope: Page | Locator, dir = '/') {
  return scope.locator('video').evaluateAll((videos, dir) => (videos as HTMLVideoElement[])
    .filter(v => !v.paused && !v.ended && v.currentTime > 0)
    .map(v => new URL(v.currentSrc).pathname)
    .filter(path => path.startsWith(dir)), dir)
}

// Keeps count, in the page, of the most clips ever playing at once; only
// those under `dir` if given.
export async function countPeakPlaying(page: Page, dir = '/') {
  await page.addInitScript((dir) => {
    const w = window as unknown as { peakPlaying: number }
    w.peakPlaying = 0
    document.addEventListener('playing', () => {
      const now = [...document.querySelectorAll('video')]
        .filter(v => !v.paused && new URL(v.currentSrc).pathname.startsWith(dir)).length
      w.peakPlaying = Math.max(w.peakPlaying, now)
    }, true)
  }, dir)
  return () => page.evaluate(() => (window as unknown as { peakPlaying: number }).peakPlaying)
}

// The still shown for clip `id` (its poster, /clips/<id>-<theme>.png), loaded.
export function clipStill(scope: Page | Locator, id: string, theme: 'light' | 'dark' = 'light') {
  return scope.locator(`img[src="/clips/${id}-${theme}.png"]`)
}
