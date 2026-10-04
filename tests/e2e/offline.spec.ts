import type { Page, Route } from '@playwright/test'
import { expect, test } from './fixtures'
import { signIn } from './auth'
import { clipStill, playing } from './clips'
import { gotoHydrated } from './hydration'

// The Offline screen (PRD story 8). Opening malkochen without a connection
// gets the service worker's Offline page; losing the connection with the app
// open shows the Offline screen over it until the connection is back.

// The service worker is what serves the Offline page (blocked elsewhere,
// playwright.config.ts).
test.use({ serviceWorkers: 'allow' })

async function serviceWorkerInControl(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready)
  // A first visit isn't controlled until the worker claims it.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
}

test('opening malkochen offline shows the Offline page, which carries on once back online', async ({ page, context }) => {
  await signIn(page)
  await gotoHydrated(page, '/')
  await serviceWorkerInControl(page)

  await context.setOffline(true)
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Du bist offline.')
  // The service worker keeps the offline clip, so it plays with no connection.
  await expect.poll(() => playing(page)).toEqual(['/clips/offline-light.webm'])

  await expect(page.getByRole('button', { name: 'Nochmal versuchen' })).toBeVisible()

  // No need to press it: the page reloads itself when the connection is back.
  await context.setOffline(false)
  await expect(page).toHaveURL(/\/b\//)
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Du bist offline.')
})

// A device often says it is back online before the connection gets
// through (Wi-Fi joined, DNS not answering yet): the Offline page keeps
// trying instead of stopping at its first failed try.
test('back online before the connection gets through, the Offline page keeps trying and carries on', async ({ page, context }) => {
  await signIn(page)
  await gotoHydrated(page, '/')
  await serviceWorkerInControl(page)
  await context.setOffline(true)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Du bist offline.')

  await context.route(url => url.pathname === '/', route => route.abort('internetdisconnected'), { times: 1 })
  await context.setOffline(false)

  await expect(page).toHaveURL(/\/b\//)
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('malkochen ist gerade nicht erreichbar.')
})

test('the service worker keeps the splash stills, so a cold launch paints them without the network', async ({ page, context }) => {
  await gotoHydrated(page, '/login')
  await serviceWorkerInControl(page)

  await context.setOffline(true)
  for (const still of ['', '-landscape'].flatMap(o => [`/clips/splash${o}-poster.webp`, `/clips/splash${o}-still.webp`])) {
    const type = await page.evaluate(async url => (await fetch(url)).headers.get('content-type'), still)
    expect(type, still).toBe('image/webp')
  }
})

// The device is online but malkochen doesn't answer: say it's on our side.
// context.route sees the service worker's own requests.
for (const [what, outage] of [
  ['no answer at all', (route: Route) => route.abort('connectionrefused')],
  ['a Vercel platform error', (route: Route) => route.fulfill({ status: 502, headers: { 'x-vercel-error': 'NO_RESPONSE_FROM_FUNCTION' }, body: 'An error occurred' })],
] as const) {
  test(`when malkochen is down (${what}), the page says so and that it isn't the user's connection`, async ({ page, context }) => {
    await signIn(page)
    await gotoHydrated(page, '/')
    await serviceWorkerInControl(page)

    const landing = (url: URL) => url.pathname === '/'
    await context.route(landing, outage)
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('malkochen ist gerade nicht erreichbar.')
    await expect(page.getByText('Das liegt an uns, nicht an dir.')).toBeVisible()
    await expect(page.locator('img[src="/illustrations/topfbert-oops.svg"]')).toBeVisible()

    await context.unroute(landing)
    await page.getByRole('button', { name: 'Nochmal versuchen' }).click()
    await expect(page).toHaveURL(/\/b\//)
  })
}

test('losing the connection with the app open shows the Offline screen until it is back', async ({ page, context }) => {
  await signIn(page)
  await gotoHydrated(page, '/')
  await serviceWorkerInControl(page)
  const offline = page.getByRole('alertdialog', { name: 'Du bist offline.' })
  await expect(offline).toHaveCount(0)

  await context.setOffline(true)
  await expect(offline).toBeVisible()
  await expect.poll(() => playing(offline)).toEqual(['/clips/offline-light.webm'])
  // The app underneath is out of reach until the connection is back.
  await expect(offline.getByRole('button', { name: 'Nochmal versuchen' })).toBeFocused()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => document.activeElement?.closest('main') ?? null)).toBeNull()

  await context.setOffline(false)
  await expect(offline).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()
})

test('with reduced motion the Offline screen shows its clip\'s still, and no clip plays', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page)
  await gotoHydrated(page, '/')
  await serviceWorkerInControl(page)

  await context.setOffline(true)
  const offline = page.getByRole('alertdialog', { name: 'Du bist offline.' })
  await expect(clipStill(offline, 'offline')).toBeVisible()
  // And the Offline page the service worker serves.
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Du bist offline.')
  await expect(clipStill(page, 'offline')).toBeVisible()
  await expect(page.locator('video')).toBeHidden()
  expect(await playing(page)).toEqual([])
  await context.setOffline(false)
})
