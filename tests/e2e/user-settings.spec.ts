import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'

// User settings (PRD stories 73–75): your Google name and photo, Darstellung
// and signing out. Jean is used by this file only.
const JEAN = ALLOWLISTED[18]
// Stands in for Google's photo URL; served by the app, so it loads offline.
const PHOTO = `${E2E_ORIGIN}/icons/icon-192.png`

// Handoff tokens.css: light --color-bg #F7F6F2, dark #131211.
const LIGHT_BG = 'rgb(247, 246, 242)'
const DARK_BG = 'rgb(19, 18, 17)'

test.use({ colorScheme: 'light' })

test.beforeEach(async ({ page }) => {
  await signIn(page, JEAN, { name: 'Jean Bartik', image: PHOTO })
})

test('your photo on the Board opens your settings, with your Google name and photo', async ({ page }) => {
  await gotoHydrated(page, '/')
  const board = page.url()

  await page.getByRole('link', { name: 'Deine Einstellungen' }).click()

  await expect(page).toHaveURL('/settings')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen')
  const account = page.getByRole('region', { name: 'Konto' })
  await expect(account.getByText('Jean Bartik')).toBeVisible()
  await expect(account.getByText(JEAN)).toBeVisible()
  await expect(account.locator(`img[src="${PHOTO}"]`)).toBeVisible()
  // German only for now: the language setting has its place but no choice yet.
  await expect(page.getByRole('region', { name: 'Sprache' }).getByText('Deutsch')).toBeVisible()

  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(page).toHaveURL(board)
})

test('on a phone your settings are the last row of the Board switcher', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/')
  // No room in the header beside the Board's name.
  await expect(page.getByRole('link', { name: 'Deine Einstellungen' })).toHaveCount(0)

  await page.getByRole('button', { name: /Board wechseln/ }).click()
  const panel = page.getByRole('navigation')
  await expect(panel.getByRole('listitem').last()).toContainText('Deine Einstellungen')
  await panel.getByRole('link', { name: 'Deine Einstellungen' }).click()

  await expect(page).toHaveURL('/settings')
})

test('Darstellung switches between light and dark, and the choice survives a reload', async ({ page }) => {
  await gotoHydrated(page, '/settings')
  const main = page.getByRole('main')
  await expect(main).toHaveCSS('background-color', LIGHT_BG)

  await page.getByRole('radio', { name: 'Dunkel' }).click()
  await expect(page.getByRole('radio', { name: 'Dunkel' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(main).toHaveCSS('background-color', DARK_BG)

  await reloadHydrated(page)
  await expect(main).toHaveCSS('background-color', DARK_BG)
  await gotoHydrated(page, '/')
  await expect(page.getByRole('main')).toHaveCSS('background-color', DARK_BG)

  await gotoHydrated(page, '/settings')
  await page.getByRole('radio', { name: 'Hell' }).click()
  await expect(page.getByRole('main')).toHaveCSS('background-color', LIGHT_BG)
})

test('"System" follows the device colour scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await gotoHydrated(page, '/settings')

  await page.getByRole('radio', { name: 'System' }).click()

  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  await expect(page.getByRole('main')).toHaveCSS('background-color', DARK_BG)
})

// The Theme reveal (handoff motion.json "Theme reveal"), as the page runs it:
// what animates the View Transition's picture of the new theme, and the
// cross-fade without one.
const NEW_THEME = '::view-transition-new(root)'

interface Reveal { duration: number, easing: string, from: string, to: string }

// The reveal running now, if any: the clip-path animation on the new theme.
function reveal(page: Page): Promise<Reveal | null> {
  return page.evaluate((pseudo) => {
    const found = document.getAnimations().find(a => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo
      && (a.effect as KeyframeEffect).getKeyframes().some(k => k.clipPath))
    if (!found) return null
    const effect = found.effect as KeyframeEffect
    const [first, last] = [effect.getKeyframes().at(0)!, effect.getKeyframes().at(-1)!]
    return { duration: Number(effect.getTiming().duration), easing: String(effect.getTiming().easing), from: String(first.clipPath), to: String(last.clipPath) }
  }, NEW_THEME)
}

// Counts the View Transitions the page starts, and every value <html
// data-theme-reveal> takes from now on, with how long <main>'s background
// then takes to change (the cross-fade, if any).
async function watchTransitions(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { transitions: number, reveals: string[], fades: string[] }
    w.transitions = 0
    w.reveals = []
    w.fades = []
    const start = document.startViewTransition?.bind(document)
    if (start) {
      document.startViewTransition = ((update?: ViewTransitionUpdateCallback) => {
        w.transitions++
        return start(update)
      }) as typeof document.startViewTransition
    }
    new MutationObserver(() => {
      const value = document.documentElement.dataset.themeReveal
      if (!value) return
      w.reveals.push(value)
      const main = getComputedStyle(document.querySelector('main')!)
      const i = main.transitionProperty.split(', ').indexOf('background-color')
      w.fades.push(i < 0 ? 'none' : main.transitionDuration.split(', ')[i]!)
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-reveal'] })
  })
  return {
    transitions: () => page.evaluate(() => (window as unknown as { transitions: number }).transitions),
    reveals: () => page.evaluate(() => (window as unknown as { reveals: string[] }).reveals),
    fades: () => page.evaluate(() => (window as unknown as { fades: string[] }).fades),
  }
}

test('picking Dunkel reveals it from the tapped option in 600ms (swoosh), and Hell the same way back', async ({ page }) => {
  await gotoHydrated(page, '/settings')

  for (const [name, background] of [['Dunkel', DARK_BG], ['Hell', LIGHT_BG]] as const) {
    const option = page.getByRole('radio', { name })
    const box = (await option.boundingBox())!
    await option.click()

    await expect.poll(() => reveal(page)).not.toBeNull()
    const { duration, easing, from, to } = (await reveal(page))!
    expect(duration).toBe(600)
    expect(easing).toBe('cubic-bezier(0.45, 0, 0.2, 1)')
    // A circle growing from the middle of the tapped option over the whole page.
    const [, radius, x, y] = from.match(/circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)/)!.map(Number)
    expect(radius).toBe(0)
    expect(x).toBeCloseTo(box.x + box.width / 2, 0)
    expect(y).toBeCloseTo(box.y + box.height / 2, 0)
    expect(to).toMatch(/^circle\([\d.]+px at /)
    await expect(page.getByRole('main')).toHaveCSS('background-color', background)
    await expect.poll(() => reveal(page)).toBeNull()
  }
})

test('"System" reveals nothing when the device already shows the same theme', async ({ page }) => {
  await gotoHydrated(page, '/settings')
  const watched = await watchTransitions(page)

  // Light now, and the device is light too.
  await page.getByRole('radio', { name: 'System' }).click()

  await expect(page.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  expect(await watched.transitions()).toBe(0)
  expect(await watched.reveals()).toEqual([])
})

test('"System" reveals the device’s theme when it differs', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await gotoHydrated(page, '/settings')
  await page.getByRole('radio', { name: 'Hell' }).click()
  await expect.poll(() => reveal(page)).toBeNull()

  await page.getByRole('radio', { name: 'System' }).click()

  await expect.poll(() => reveal(page)).not.toBeNull()
  await expect(page.getByRole('main')).toHaveCSS('background-color', DARK_BG)
})

test('without View Transitions, the theme cross-fades', async ({ page }) => {
  await page.addInitScript(() => {
    delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition
  })
  await gotoHydrated(page, '/settings')
  const watched = await watchTransitions(page)

  await page.getByRole('radio', { name: 'Dunkel' }).click()

  await expect(page.getByRole('main')).toHaveCSS('background-color', DARK_BG)
  expect(await watched.reveals()).toEqual(['fade'])
  expect(await watched.fades()).toEqual(['0.24s'])
  // Over once it has faded.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-reveal')
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the theme switches at once with a 200ms cross-fade, and nothing spreads out', async ({ page }) => {
    await gotoHydrated(page, '/settings')
    const watched = await watchTransitions(page)

    await page.getByRole('radio', { name: 'Dunkel' }).click()

    await expect(page.getByRole('main')).toHaveCSS('background-color', DARK_BG)
    expect(await watched.reveals()).toEqual(['fade'])
    expect(await watched.fades()).toEqual(['0.2s'])
    expect(await reveal(page)).toBeNull()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-reveal')
  })
})

test('"Abmelden" ends the session and returns to the sign-in screen', async ({ page }) => {
  await gotoHydrated(page, '/settings')

  await page.getByRole('button', { name: 'Abmelden' }).click()

  await expect(page).toHaveURL('/login')
  expect((await page.request.get('/api/me')).status()).toBe(401)
  await gotoHydrated(page, '/settings')
  await expect(page).toHaveURL('/login')
})
