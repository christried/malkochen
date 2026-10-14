import type { Page } from '@playwright/test'
import { expect, testWithSplash as test } from './fixtures'
import { signIn } from './auth'
import { backgroundsBehind, moving } from './clips'
import { gotoHydrated, reloadHydrated } from './hydration'

// The splash (handoff "Splash"; #216): on the first load of a tab session it
// is drawn in the page over it, plays from frame 10, holds its last frame
// until it has been up 2s, then fades to the page; a tap closes it at once.
// Never again in that tab, and never on in-app navigation. This file uses
// `testWithSplash`, so its tabs start without the opt-out every other file
// has.

const splash = (page: Page) => page.locator('[data-splash]')

// A phone held upright, and a 16:9 desktop window.
const PHONE = { width: 412, height: 915 }
const WIDE = { width: 1600, height: 900 }

// Every file the page asks for that a splash once came from: there are none.
function splashFileRequests(page: Page) {
  const urls: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith('/clips/splash')) urls.push(pathname)
  })
  return urls
}

// The splash's life in the page, in ms since the page was asked for
// (performance.now()): when it first stood at its last frame (all its
// animations done), when it was tapped away, when it began to leave, when it
// was gone.
type SplashLife = { heldAt: number | null, skippedAt: number | null, leavingAt: number | null, goneAt: number | null }
async function watchSplash(page: Page) {
  await page.addInitScript(() => {
    const life: SplashLife = { heldAt: null, skippedAt: null, leavingAt: null, goneAt: null }
    ;(window as unknown as { splashLife: SplashLife }).splashLife = life
    let seen = false
    const sample = () => {
      const el = document.querySelector<HTMLElement>('[data-splash]')
      if (el) {
        seen = true
        if (document.documentElement.dataset.splashSkipped !== undefined) life.skippedAt ??= performance.now()
        if (el.classList.contains('leaving')) life.leavingAt ??= performance.now()
        else if (el.getAnimations({ subtree: true }).every(a => a.playState === 'finished' || (a as CSSAnimation).animationName?.startsWith('splash-fallback'))) life.heldAt ??= performance.now()
      }
      else if (seen) {
        life.goneAt ??= performance.now()
        return
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  return () => page.evaluate(() => (window as unknown as { splashLife: SplashLife }).splashLife)
}

// Whether the splash showed when the page was first parsed: what the first
// paint would show.
async function watchFirstPaint(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { splashAtFirstPaint: boolean | null }
    w.splashAtFirstPaint = null
    document.addEventListener('DOMContentLoaded', () => {
      w.splashAtFirstPaint = document.querySelector('[data-splash]')?.checkVisibility() ?? false
    })
  })
  return () => page.evaluate(() => (window as unknown as { splashAtFirstPaint: boolean | null }).splashAtFirstPaint)
}

// Whether `box` lies within the window, and how far its centre is from the
// window's middle, across.
async function placement(page: Page, selector: string) {
  const box = (await splash(page).locator(selector).boundingBox())!
  const { width, height } = page.viewportSize()!
  return {
    inside: box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height,
    offCentre: Math.abs(box.x + box.width / 2 - width / 2),
  }
}

test('a fresh tab draws the splash from the first paint, holds its last frame, and shows the page after 2s', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.emulateMedia({ colorScheme: 'light' })
  const requests = splashFileRequests(page)
  const life = await watchSplash(page)
  const atFirstPaint = await watchFirstPaint(page)

  await page.goto('/login')

  // In the page as the server sends it, over everything from the first paint:
  // a drawing and text, no video, no image, nothing to load.
  expect(await atFirstPaint()).toBe(true)
  await expect(splash(page).locator('[data-splash-drawing]')).toBeVisible()
  await expect(splash(page).getByText('malkochen')).toBeVisible()
  await expect(splash(page).locator('video, img')).toHaveCount(0)
  expect(await backgroundsBehind(splash(page).locator('.stage'), '[data-splash]')).toEqual([])

  await expect(splash(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  const { heldAt, leavingAt, goneAt } = await life()
  // Played through, then stood at its last frame until it was time to go.
  expect(heldAt).not.toBeNull()
  expect(heldAt!).toBeLessThan(leavingAt!)
  expect(leavingAt!).toBeGreaterThanOrEqual(2000)
  expect(goneAt!).toBeGreaterThan(leavingAt!)
  expect(requests).toEqual([])
})

// As soon as it shows, before the app is up to answer: a slow phone can show
// the splash a while before then.
test('a tap on the splash closes it at once, even before the app is up, and shows the page', async ({ page }) => {
  await page.setViewportSize(PHONE)
  const life = await watchSplash(page)
  await page.goto('/login', { waitUntil: 'commit' })

  await splash(page).click()

  await expect(splash(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  // Gone well before its 2s were up.
  const { skippedAt, goneAt } = await life()
  expect(skippedAt!).toBeLessThan(2000)
  expect(goneAt!).toBeGreaterThan(skippedAt!)
})

for (const [window, viewport, theme] of [['a phone', PHONE, 'light'], ['a wide window', WIDE, 'dark']] as const) {
  test(`${window} in ${theme}: icon and wordmark whole and centred on the butter`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ colorScheme: theme })
    // Looked at while it shows, in its first 2s.
    await page.goto('/login', { waitUntil: 'commit' })

    for (const part of ['[data-layer="icon"]', '[data-layer="wordmark"]']) {
      const { inside, offCentre } = await placement(page, part)
      expect(inside, part).toBe(true)
      expect(offCentre, part).toBeLessThan(viewport.width * 0.05)
    }
    // The butter behind it, in either theme: the native splash's colour.
    await expect(splash(page)).toHaveCSS('background-image', /linear-gradient/)
  })
}

test('a reload in the same tab shows no splash, not even for a frame, nor does in-app navigation', async ({ page }) => {
  await gotoHydrated(page, '/login')
  await expect(splash(page)).toHaveCount(0)

  const atFirstPaint = await watchFirstPaint(page)
  await reloadHydrated(page)

  expect(await atFirstPaint()).toBe(false)
  await expect(splash(page)).toHaveCount(0)

  await page.evaluate(() => (window as unknown as { useNuxtApp: () => { $router: { push: (to: string) => Promise<unknown> } } })
    .useNuxtApp().$router.push('/login?error=not_allowed'))
  await expect(page).toHaveURL(/error=not_allowed/)
  await expect(splash(page)).toHaveCount(0)
})

test('with reduced motion the splash stands still at its last frame, and shows the page after 2s', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const life = await watchSplash(page)

  await page.goto('/login')

  await expect(splash(page).getByText('malkochen')).toBeVisible()
  await expect(splash(page).locator('[data-splash-drawing]')).toBeVisible()
  // (Only the fallback that would fade it, were there no app script, waits.)
  expect((await moving(splash(page))).filter(name => !name.startsWith('splash-fallback'))).toEqual([])
  await expect(splash(page).locator('[data-layer="dot"]')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')

  await expect(splash(page)).toHaveCount(0)
  expect((await life()).leavingAt!).toBeGreaterThanOrEqual(2000)
})

test('a fresh tab that lands on the error screen shows no splash on its way back into the app', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/b/00000000-0000-4000-8000-000000000000')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Das gibt’s hier nicht.')

  await page.getByRole('button', { name: 'Zu malkochen' }).click()

  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()
  await expect(splash(page)).toHaveCount(0)
})

test.describe('without the app script', () => {
  test.use({ javaScriptEnabled: false })

  test('the splash still fades by itself', async ({ page }) => {
    await page.goto('/login')

    await expect(splash(page)).toBeVisible()
    await expect(splash(page)).toBeHidden({ timeout: 6000 })
  })
})
