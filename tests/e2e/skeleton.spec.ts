import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { openUserSettings } from './settings-sheet'

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
      await expect(h1).toHaveText('Was willst du malkochen?')
      await expect(h1).toHaveCSS('font-size', size)
      await expect(h1).toHaveCSS('font-family', /Petrona/)
    })
  }

  // tokens.json font.load: Petrona and Figtree, variable with italics, from
  // the app itself (not Google), each with a size-adjusted fallback face so
  // the text doesn't jump when the font arrives.
  test('the display and UI fonts load self-hosted, with fallbacks sized to match', async ({ page }) => {
    const fontRequests: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fontRequests.push(new URL(request.url()).host)
    })
    await gotoHydrated(page, '/login')
    await page.evaluate(() => Promise.all([
      document.fonts.load('500 40px Petrona', 'ÄÖÜß'),
      document.fonts.load('italic 400 22px Petrona'),
      document.fonts.load('600 15px Figtree', 'àèéìòù'),
      document.fonts.load('italic 500 15px Figtree'),
    ]))
    const loaded = await page.evaluate(() =>
      [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.style} ${f.weight}`))
    expect(loaded).toEqual(expect.arrayContaining(['Petrona normal 100 900', 'Petrona italic 100 900', 'Figtree normal 300 900', 'Figtree italic 300 900']))
    expect(fontRequests.length).toBeGreaterThan(0)
    expect(new Set(fontRequests)).toEqual(new Set([new URL(page.url()).host]))
    expect(await token(page, '--font-display')).toMatch(/^["']Petrona["'], "Petrona Fallback: [^"]+"/)
    expect(await token(page, '--font-ui')).toMatch(/^["']Figtree["'], "Figtree Fallback: [^"]+"/)
  })
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('motion tokens collapse and fades shorten to 200ms', async ({ page }) => {
    await signIn(page)
    await openUserSettings(page)
    expect(await token(page, '--dur-pop')).toBe('0ms')
    expect(await token(page, '--dur-fade')).toBe('200ms')
    await expect(page.getByRole('radio', { name: 'Hell' })).toHaveCSS('transition-duration', '0.2s')
  })
})

test.describe('full motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('motion tokens keep their handoff values', async ({ page }) => {
    await signIn(page)
    await openUserSettings(page)
    expect(await token(page, '--dur-pop')).toBe('460ms')
    await expect(page.getByRole('radio', { name: 'Hell' })).toHaveCSS('transition-duration', '0.24s')
  })
})
