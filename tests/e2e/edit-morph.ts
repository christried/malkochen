import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

// Plays every animation on `page` 10× slower (Chromium), so a short one is
// still running when the test looks; their timing stays as set. Returns
// what puts them back to normal speed.
export async function slowAnimations(page: Page): Promise<() => Promise<void>> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Animation.enable')
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 })
  return async () => {
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 })
    await cdp.detach()
  }
}

// The Dish detail's edit mode morph (handoff motion.json "Edit mode morph"),
// as it runs in `detail`: each animation's timing, in the order of the
// fields, and whether it moves its field or only fades it in. Waits for the
// morph to start.
export async function editMorph(detail: Locator) {
  const morph = () => detail.evaluate(el => el.getAnimations({ subtree: true })
    .filter(animation => animation.id === 'edit-morph')
    .map((animation) => {
      const effect = animation.effect as KeyframeEffect
      const { delay, duration, easing } = effect.getTiming()
      return { delay, duration, easing, moves: effect.getKeyframes().some(frame => 'translate' in frame) }
    }))
  await expect.poll(async () => (await morph()).length).toBeGreaterThan(0)
  return morph()
}

// The handoff's settle easing (tokens.css --ease-settle), as Web Animations
// give it back.
const SETTLE = 'cubic-bezier(0.3, 1.3, 0.5, 1)'

// Expects the morph running in `detail` to move its fields one after
// another: 380ms a field with settle, each 60ms after the one before.
export async function expectFieldsMorphing(detail: Locator) {
  const morph = await editMorph(detail)
  expect(morph.length).toBeGreaterThan(3)
  expect(morph.map(({ delay, duration, easing }) => ({ delay, duration, easing })))
    .toEqual(morph.map((_, i) => ({ delay: i * 60, duration: 380, easing: SETTLE })))
  expect(morph.filter(field => field.moves).length).toBeGreaterThan(3)
}
