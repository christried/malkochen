import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

// Loading states: saving buttons and the Add Dish link field while their
// requests run.

// The light theme's sage (tokens.css --color-sage), as computed styles give it.
export const SAGE = 'rgb(165, 199, 174)'

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

// Whether the dots inside `within` move: never, with reduced motion.
export function dotsMoving(within: Locator): Promise<boolean> {
  return loadingDots(within).evaluate(dots => dots.getAnimations({ subtree: true }).length > 0)
}

// Clicks a saving button whose request is held, and expects it to save: the
// three dots in place of its label, at the width it had before, named
// `name`, and not dimmed like a disabled button.
export async function clickAndExpectSaving(button: Locator, name: string) {
  const width = await layoutWidth(button)
  await button.click()
  await expect(button).toHaveAccessibleName(name)
  await expect(loadingDots(button)).toBeVisible()
  await expect(button).toHaveCSS('opacity', '1')
  expect(await layoutWidth(button)).toBe(width)
}

// An element's width in the layout: what a label change would jump, without
// the transforms of a press or a sheet still springing open.
function layoutWidth(element: Locator): Promise<number> {
  return element.evaluate(el => (el as HTMLElement).offsetWidth)
}

// Add Dish's link field with what sits in it: the Source's dot, the
// lookup's state and "Einfügen".
export function linkField(sheet: Locator) {
  return sheet.locator('[data-link-field]')
}

// The check the link field shows once its link is found.
export function linkFound(sheet: Locator) {
  return linkField(sheet).locator('[data-link-found]')
}
