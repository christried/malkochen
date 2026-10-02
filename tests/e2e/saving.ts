import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

// Holds every `method` request to a URL matching `url` until the returned
// function releases them, to see what shows while they run.
export async function holdRequests(page: Page, method: string, url: RegExp): Promise<() => void> {
  let release!: () => void
  const held = new Promise<void>(resolve => release = resolve)
  await page.route(url, async (route) => {
    if (route.request().method() === method) await held
    await route.fallback()
  })
  return release
}

// The three loading dots (handoff components.json: Button "loading (3 dots)",
// Input "loading (dots)").
export function loadingDots(within: Locator) {
  return within.locator('[data-loading-dots]')
}

// A button while it saves: the three dots in place of its label, at the
// width it had before, still named as saving, and not dimmed like a disabled
// button.
export async function expectSaving(button: Locator, name: string, width: number) {
  await expect(button).toHaveAccessibleName(name)
  await expect(loadingDots(button)).toBeVisible()
  await expect(button).toHaveCSS('opacity', '1')
  expect(await layoutWidth(button)).toBe(width)
}

// An element's width in the layout: what a label change would jump, without
// the transforms of a press or a sheet still springing open.
export function layoutWidth(element: Locator): Promise<number> {
  return element.evaluate(el => (el as HTMLElement).offsetWidth)
}

// Whether the dots inside `within` move: never, with reduced motion.
export function dotsMoving(within: Locator): Promise<boolean> {
  return loadingDots(within).evaluate(dots => dots.getAnimations({ subtree: true }).length > 0)
}
