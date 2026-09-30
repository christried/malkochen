import { expect, test, type Page } from '@playwright/test'
import { gotoHydrated, reloadHydrated } from './hydration'

// Handoff tokens.css: light --color-bg #F7F6F2, dark #131211.
const LIGHT_BG = 'rgb(247, 246, 242)'
const DARK_BG = 'rgb(19, 18, 17)'

const token = (page: Page, name: string) =>
  page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

test.describe('design tokens', () => {
  test.use({ colorScheme: 'light' })

  test('the page switches between light and dark, and the choice survives a reload', async ({ page }) => {
    await gotoHydrated(page, '/')
    const main = page.getByRole('main')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was willst du mal kochen?')
    await expect(main).toHaveCSS('background-color', LIGHT_BG)

    await page.getByRole('radio', { name: 'Dunkel' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(main).toHaveCSS('background-color', DARK_BG)

    await reloadHydrated(page)
    await expect(main).toHaveCSS('background-color', DARK_BG)

    await page.getByRole('radio', { name: 'Hell' }).click()
    await expect(main).toHaveCSS('background-color', LIGHT_BG)
  })

  test('"System" follows the device colour scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await gotoHydrated(page, '/')
    await page.getByRole('radio', { name: 'System' }).click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme')
    await expect(page.getByRole('main')).toHaveCSS('background-color', DARK_BG)
  })

  // tokens.json breakpoints: phone < 768, tablet 768–1199, desktop ≥ 1200.
  // The headline is display-m / display-l / display-xl (32 / 40 / 54px).
  for (const [width, size] of [[767, '32px'], [768, '40px'], [1199, '40px'], [1200, '54px']] as const) {
    test(`at ${width}px the headline uses the ${size} display size`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await gotoHydrated(page, '/')
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toHaveCSS('font-size', size)
      await expect(h1).toHaveCSS('font-family', /Newsreader/)
    })
  }
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('motion tokens collapse and fades shorten to 200ms', async ({ page }) => {
    await gotoHydrated(page, '/')
    expect(await token(page, '--dur-pop')).toBe('0ms')
    expect(await token(page, '--dur-fade')).toBe('200ms')
    await expect(page.getByRole('radio', { name: 'Hell' })).toHaveCSS('transition-duration', '0.2s')
  })
})

test.describe('full motion', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('motion tokens keep their handoff values', async ({ page }) => {
    await gotoHydrated(page, '/')
    expect(await token(page, '--dur-pop')).toBe('460ms')
    await expect(page.getByRole('radio', { name: 'Hell' })).toHaveCSS('transition-duration', '0.24s')
  })
})
