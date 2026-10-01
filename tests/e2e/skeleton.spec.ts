import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'

const token = (page: Page, name: string) =>
  page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

test.describe('design tokens', () => {
  // Switching between light and dark: user-settings.spec.ts.

  // tokens.json breakpoints: phone < 768, tablet 768–1199, desktop ≥ 1200.
  // The sign-in headline is display-m / display-l / display-xl (32 / 40 / 54px).
  for (const [width, size] of [[767, '32px'], [768, '40px'], [1199, '40px'], [1200, '54px']] as const) {
    test(`at ${width}px the headline uses the ${size} display size`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await gotoHydrated(page, '/login')
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toHaveText('Was willst du mal kochen?')
      await expect(h1).toHaveCSS('font-size', size)
      await expect(h1).toHaveCSS('font-family', /Newsreader/)
    })
  }
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('motion tokens collapse and fades shorten to 200ms', async ({ page }) => {
    await signIn(page)
    await gotoHydrated(page, '/settings')
    expect(await token(page, '--dur-pop')).toBe('0ms')
    expect(await token(page, '--dur-fade')).toBe('200ms')
    await expect(page.getByRole('radio', { name: 'Hell' })).toHaveCSS('transition-duration', '0.2s')
  })
})

test.describe('full motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('motion tokens keep their handoff values', async ({ page }) => {
    await signIn(page)
    await gotoHydrated(page, '/settings')
    expect(await token(page, '--dur-pop')).toBe('460ms')
    await expect(page.getByRole('radio', { name: 'Hell' })).toHaveCSS('transition-duration', '0.24s')
  })
})
