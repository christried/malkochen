import type { Page, Route } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { TOUR_VERSION } from '../../app/tour/tour'
import { signIn } from './auth'
import { moving } from './clips'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { fastPolls } from './polls'
import { landingBoardId, removeUsers, seedDish, setSeen } from './seed'

// The Offline page (PRD story 8): opening malkochen without a connection
// gets the service worker's Offline page. Losing the connection with the app
// open shows the offline bar instead (#458), further down.

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
  // The page has the offline clip drawn in, so it plays with no connection,
  // with no box of its own.
  const drawing = page.locator('svg[data-clip="offline"]')
  await expect(drawing).toBeVisible()
  await expect.poll(() => moving(drawing)).toEqual(expect.arrayContaining(['of-arc-outer', 'of-arc-inner', 'tb-bob']))
  expect(await drawing.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')

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
    // Topfbert, idling.
    const topfbert = page.locator('[data-topfbert-idle]')
    await expect(topfbert).toBeVisible()
    await expect.poll(() => topfbert.evaluate(el => el.getAnimations({ subtree: true }).length)).toBeGreaterThan(0)

    await context.unroute(landing)
    await page.getByRole('button', { name: 'Nochmal versuchen' }).click()
    await expect(page).toHaveURL(/\/b\//)
  })
}

// The offline bar (#458): losing the connection with a Board open no longer
// covers it. The Board and a Dish's detail stay there to read, a small bar
// says what's going on, and every change is greyed out or hidden with "Geht
// nur mit Netz" until a request gets an answer again. Hildegard, Sibylla,
// Agnodice and Theano are used by this file only.
const HILDEGARD = ALLOWLISTED[198]
const SIBYLLA = ALLOWLISTED[199]
const AGNODICE = ALLOWLISTED[200]
const THEANO = ALLOWLISTED[201]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const NEEDS_NET = 'Geht nur mit Netz'

const bar = (page: Page, text: string) => page.locator('[data-offline-bar]').filter({ hasText: text })
const offlineBar = (page: Page) => bar(page, 'Offline. Deine Änderungen kommen an, sobald du Netz hast.')
const unreachableBar = (page: Page) => bar(page, 'malkochen ist gerade nicht erreichbar.')

test('losing the connection on a Board shows the offline bar over it, every change greyed out, until it is back', async ({ page, context }) => {
  await removeUsers(HILDEGARD)
  await signIn(page, HILDEGARD)
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Linsensuppe', sourceLink: TIKTOK, sourceKind: 'tiktok', addedBy: HILDEGARD })
  await reloadHydrated(page)
  const add = page.getByRole('button', { name: 'Gericht hinzufügen' })
  await expect(add).not.toHaveAttribute('aria-disabled')
  await expect(offlineBar(page)).toBeHidden()

  await context.setOffline(true)

  // Said politely, and nothing covers the Board.
  await expect(offlineBar(page)).toBeVisible()
  await expect(page.locator('[data-offline-bar]')).toHaveAttribute('aria-live', 'polite')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  expect(await page.locator('main').evaluate(el => el.closest('[inert]') === null)).toBe(true)
  // Adding is greyed out and says why; cooking and the card's menu are gone.
  await expect(add).toHaveAttribute('aria-disabled', 'true')
  await expect(add).toHaveAttribute('data-tooltip', NEEDS_NET)
  // Playwright never clicks a button that says it is disabled; a finger can.
  await add.dispatchEvent('click')
  await expect(page.getByRole('status').filter({ hasText: NEEDS_NET })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Gericht hinzufügen' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Gekocht ✓: „Linsensuppe“' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mehr zu „Linsensuppe“' })).toHaveCount(0)

  // The Dish's detail opens to read; its changes are greyed out.
  await page.getByRole('link', { name: 'Linsensuppe' }).click()
  const detail = page.getByRole('dialog', { name: 'Linsensuppe' })
  await expect(detail.getByRole('heading', { name: 'Linsensuppe', level: 1 })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Bearbeiten' }).first()).toHaveAttribute('aria-disabled', 'true')
  await expect(detail.getByRole('button', { name: 'Verschieben nach…' })).toBeDisabled()
  await expect(detail.getByRole('textbox', { name: 'Kommentar' })).toBeDisabled()
  await expect(detail.locator('[data-dish-history]').getByText(NEEDS_NET)).toBeVisible()
  // The bar shows over the detail too.
  await expect(offlineBar(page)).toBeVisible()

  await context.setOffline(false)

  await expect(offlineBar(page)).toBeHidden()
  await expect(detail.getByRole('textbox', { name: 'Kommentar' })).toBeEnabled()
  await expect(detail.getByRole('button', { name: 'Verschieben nach…' })).toBeEnabled()
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(add).not.toHaveAttribute('aria-disabled')
  await expect(page.getByRole('button', { name: 'Gekocht ✓: „Linsensuppe“' })).toBeVisible()
})

// The device has a connection, but malkochen doesn't answer: the bar says
// it's malkochen, and goes once the Board's next check gets an answer.
for (const [what, outage] of [
  ['no answer at all', (route: Route) => route.abort('connectionrefused')],
  ['a Vercel platform error', (route: Route) => route.fulfill({ status: 502, headers: { 'x-vercel-error': 'NO_RESPONSE_FROM_FUNCTION' }, body: 'An error occurred' })],
] as const) {
  test(`when malkochen doesn't answer on a Board (${what}), the bar says it isn't reachable until it answers again`, async ({ page }) => {
    await fastPolls(page)
    await signIn(page, HILDEGARD)
    await gotoHydrated(page, '/')
    const add = page.getByRole('button', { name: 'Gericht hinzufügen' })

    const check = (url: URL) => /^\/api\/boards\/[^/]+\/version$/.test(url.pathname)
    await page.route(check, outage)

    await expect(unreachableBar(page)).toBeVisible()
    await expect(offlineBar(page)).toBeHidden()
    await expect(add).toHaveAttribute('aria-disabled', 'true')

    await page.unroute(check)
    await expect(unreachableBar(page)).toBeHidden()
    await expect(add).not.toHaveAttribute('aria-disabled')
  })
}

// Opening a Dish without a connection isn't opening it (CONTEXT.md, Dish
// History): what's new in it stays marked until it's opened online.
test('a Dish opened offline keeps "Neues im Verlauf" until it is opened online', async ({ page, browser, context }) => {
  await removeUsers(SIBYLLA, AGNODICE)
  await fastPolls(page)
  await signIn(page, SIBYLLA)
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Ofengemüse', sourceLink: TIKTOK, sourceKind: 'tiktok', addedBy: SIBYLLA })
  await reloadHydrated(page)

  const boardId = await landingBoardId(page)
  const token = await inviteToken(page, boardId)
  const other = await newTab(browser)
  await signIn(other, AGNODICE)
  const headers = { origin: E2E_ORIGIN }
  expect((await other.request.post(`/api/invites/${token}/join`, { headers })).ok()).toBe(true)
  const board = await (await other.request.get(`/api/boards/${boardId}`)).json() as { columns: { dishes: { id: string, title: string }[] }[] }
  const dish = board.columns.flatMap(c => c.dishes).find(d => d.title === 'Ofengemüse')!
  expect((await other.request.post(`/api/dishes/${dish.id}/comments`, { headers, data: { text: 'Mit Feta!' } })).ok()).toBe(true)
  await other.context().close()
  const chip = page.getByRole('link', { name: 'Ofengemüse' }).locator('[data-history-chip]')
  await expect(chip).toHaveAttribute('data-new', 'true')

  await context.setOffline(true)
  await expect(offlineBar(page)).toBeVisible()
  await page.getByRole('link', { name: 'Ofengemüse' }).click()
  const detail = page.getByRole('dialog', { name: 'Ofengemüse' })
  await expect(detail.getByRole('heading', { name: 'Ofengemüse', level: 1 })).toBeVisible()
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(detail).toBeHidden()
  await expect(chip).toHaveAttribute('data-new', 'true')

  await context.setOffline(false)
  await expect(offlineBar(page)).toBeHidden()
  await reloadHydrated(page)
  await expect(chip).toHaveAttribute('data-new', 'true')
})

// No Tour, Changelog Popup or Notification Prompt starts while offline: the
// Changelog Popup due waits until the connection is back.
test('no Changelog Popup while offline: it waits until the connection is back', async ({ page, context }) => {
  await removeUsers(THEANO)
  await page.addInitScript(() => {
    (window as { e2eChangelogPopup?: boolean }).e2eChangelogPopup = true
  })
  await signIn(page, THEANO)
  await setSeen(THEANO, { version: '0.9.0', tourSeen: TOUR_VERSION })
  await page.clock.install()
  await gotoHydrated(page, '/')
  await context.setOffline(true)
  await expect(offlineBar(page)).toBeVisible()

  const popup = page.getByRole('dialog', { name: 'Was ist neu' })
  await page.clock.runFor(5_000)
  await expect(popup).toBeHidden()

  await context.setOffline(false)
  await expect(offlineBar(page)).toBeHidden()
  await page.clock.runFor(5_000)
  await expect(popup).toBeVisible()
})

test('with reduced motion the Offline page shows its clip still', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page)
  await gotoHydrated(page, '/')
  await serviceWorkerInControl(page)

  await context.setOffline(true)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Du bist offline.')
  const drawing = page.locator('svg[data-clip="offline"]')
  await expect(drawing).toBeVisible()
  expect(await moving(drawing)).toEqual([])
  await context.setOffline(false)
})

// #170: the Offline page in the app's own fonts (kept by the service worker,
// as there's no connection to fetch them) and sizes, like the Offline
// screen: the heading in `title-l`, from 768px `display-m`; the text in
// `body`; the button in `button`.
test('the Offline page is set in the app\'s fonts and type scale, on a phone and a tablet', async ({ page, context }) => {
  await signIn(page)
  await gotoHydrated(page, '/')
  await serviceWorkerInControl(page)
  await context.setOffline(true)

  for (const [width, heading] of [
    [390, { size: '28px', lineHeight: '30.8px', weight: '500', tracking: '-0.42px' }],
    [800, { size: '32px', lineHeight: '34.56px', weight: '500', tracking: '-0.64px' }],
  ] as const) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Du bist offline.')
    const looks = await page.evaluate(async () => {
      await document.fonts.ready
      const type = (selector: string) => {
        const style = getComputedStyle(document.querySelector(selector)!)
        return { family: style.fontFamily, size: style.fontSize, lineHeight: style.lineHeight, weight: style.fontWeight, tracking: style.letterSpacing }
      }
      return {
        loaded: [...new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replaceAll('"', '')))].sort(),
        heading: type('#offline h1'),
        text: type('#offline p'),
        button: type('button'),
      }
    })
    expect(looks.loaded).toEqual(['Figtree', 'Petrona'])
    expect(looks.heading).toEqual({ family: expect.stringMatching(/^Petrona/), ...heading })
    expect(looks.text).toMatchObject({ family: expect.stringMatching(/^Figtree/), size: '15.5px', lineHeight: '22.475px', weight: '500' })
    expect(looks.button).toMatchObject({ family: expect.stringMatching(/^Figtree/), size: '15px', lineHeight: '15px', weight: '600' })
  }
  await context.setOffline(false)
})
