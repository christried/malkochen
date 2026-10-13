import type { Page } from '@playwright/test'
import { expect, testWithSplash as test } from './fixtures'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'

// The splash (handoff "Splash"): on the first load of a tab session the
// clip plays from frame 10 over the page, then fades to it. Never again in
// that tab, and never on in-app navigation. This file uses `testWithSplash`,
// so its tabs start without the opt-out every other file has.

const splash = (page: Page) => page.locator('[data-splash]')

// A phone held upright, and a 16:9 desktop window.
const PHONE = { width: 412, height: 915 }
const WIDE = { width: 1600, height: 900 }

// The still the splash shows (poster or reduced-motion still).
const stillShown = (page: Page) => () =>
  splash(page).locator('img').evaluate((img: HTMLImageElement) => new URL(img.currentSrc).pathname)

// Every splash clip file the page asks for.
function splashVideoRequests(page: Page) {
  const urls: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (/^\/clips\/splash-.*\.(webm|mp4)$/.test(pathname)) urls.push(pathname)
  })
  return urls
}

// The splash clip: its file, where it was when it first played (seconds),
// and whether it played to its end.
type SplashClip = { path: string, start: number, ended: boolean }
async function watchClip(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { splashClip: SplashClip | null }
    w.splashClip = null
    const isSplash = (video: HTMLVideoElement) => new URL(video.currentSrc).pathname.startsWith('/clips/splash-')
    document.addEventListener('playing', (event) => {
      const video = event.target as HTMLVideoElement
      if (isSplash(video)) w.splashClip ??= { path: new URL(video.currentSrc).pathname, start: video.currentTime, ended: false }
    }, true)
    document.addEventListener('ended', (event) => {
      if (w.splashClip && isSplash(event.target as HTMLVideoElement)) w.splashClip.ended = true
    }, true)
  })
  return () => page.evaluate(() => (window as unknown as { splashClip: SplashClip | null }).splashClip)
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

test('a fresh tab plays the splash from frame 10 over the page, then fades to the page', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.emulateMedia({ colorScheme: 'light' })
  const clip = await watchClip(page)
  const atFirstPaint = await watchFirstPaint(page)

  await page.goto('/login')

  // In the page as the server sends it, over everything from the first paint.
  expect(await atFirstPaint()).toBe(true)
  await expect.poll(stillShown(page)).toBe('/clips/splash-poster.webp')
  await expect.poll(clip).toMatchObject({ path: '/clips/splash-light.webm' })
  expect((await clip())!.start).toBeGreaterThanOrEqual(10 / 30 - 0.01)

  // Played through, then faded.
  await expect(splash(page)).toHaveCount(0)
  expect(await clip()).toMatchObject({ ended: true })
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
})

// Covering a wide window, the portrait clip would be cut and blown up.
test('a wide window gets the landscape splash, poster and clip', async ({ page }) => {
  await page.setViewportSize(WIDE)
  await page.emulateMedia({ colorScheme: 'dark' })
  const clip = await watchClip(page)

  await page.goto('/login')

  await expect.poll(stillShown(page)).toBe('/clips/splash-landscape-poster.webp')
  await expect.poll(clip).toMatchObject({ path: '/clips/splash-landscape-dark.webm' })
  await expect(splash(page)).toHaveCount(0)
  expect(await clip()).toMatchObject({ ended: true })
})

test('a reload in the same tab shows no splash, not even for a frame, nor does in-app navigation', async ({ page }) => {
  await gotoHydrated(page, '/login')
  await expect(splash(page)).toHaveCount(0)

  const requests = splashVideoRequests(page)
  const atFirstPaint = await watchFirstPaint(page)
  await reloadHydrated(page)

  expect(await atFirstPaint()).toBe(false)
  await expect(splash(page)).toHaveCount(0)

  await page.evaluate(() => (window as unknown as { useNuxtApp: () => { $router: { push: (to: string) => Promise<unknown> } } })
    .useNuxtApp().$router.push('/login?error=not_allowed'))
  await expect(page).toHaveURL(/error=not_allowed/)
  await expect(splash(page)).toHaveCount(0)
  expect(requests).toEqual([])
})

for (const [window, viewport, still] of [
  ['a phone', PHONE, '/clips/splash-still.webp'],
  ['a wide window', WIDE, '/clips/splash-landscape-still.webp'],
] as const) {
  test(`with reduced motion no clip loads: ${window} shows its frame-16 still, then fades`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const requests = splashVideoRequests(page)

    await page.goto('/login')

    await expect.poll(stillShown(page)).toBe(still)
    await expect(splash(page)).toHaveCount(0)
    expect(requests).toEqual([])
  })
}

test('a fresh tab that lands on the error screen shows no splash on its way back into the app', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/b/00000000-0000-4000-8000-000000000000')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Das gibt’s hier nicht.')
  const requests = splashVideoRequests(page)

  await page.getByRole('button', { name: 'Zu malkochen' }).click()

  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()
  await expect(splash(page)).toHaveCount(0)
  expect(requests).toEqual([])
})

test.describe('without the app script', () => {
  test.use({ javaScriptEnabled: false })

  test('the splash still fades by itself', async ({ page }) => {
    await page.goto('/login')

    await expect(splash(page)).toBeVisible()
    await expect(splash(page)).toBeHidden({ timeout: 6000 })
  })
})
