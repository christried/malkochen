import type { Page, Route } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { TOUR_VERSION } from '../../app/tour/tour'
import { PASTA_TIKTOK, REEL } from '../support/source-lookup-fixtures'
import { signIn } from './auth'
import { moving } from './clips'
import { titles } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { fastPolls } from './polls'
import { landingBoardId, removeUsers, seedDish, setSeen } from './seed'

// The Offline page (PRD story 8): opening a page malkochen doesn't keep on the
// device without a connection gets the service worker's Offline page (the
// app's own addresses open what is kept, #461). Losing the connection with the app
// open shows the offline bar instead (#458), further down.

// The service worker is what serves the Offline page (blocked elsewhere,
// playwright.config.ts).
test.use({ serviceWorkers: 'allow' })

// A page that isn't kept on the device (#461): the Offline page is what it gets.
// The app's own addresses open the kept Boards instead, further down.
const NOT_KEPT = '/changelog'

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
  await page.goto(NOT_KEPT)

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
  await expect(page).toHaveURL(/\/changelog/)
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
  await page.goto(NOT_KEPT)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Du bist offline.')

  await context.route(url => url.pathname === NOT_KEPT, route => route.abort('internetdisconnected'), { times: 1 })
  await context.setOffline(false)

  await expect(page).toHaveURL(/\/changelog/)
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

    const landing = (url: URL) => url.pathname === NOT_KEPT
    await context.route(landing, outage)
    await page.goto(NOT_KEPT)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('malkochen ist gerade nicht erreichbar.')
    await expect(page.getByText('Das liegt an uns, nicht an dir.')).toBeVisible()
    // Topfbert, idling.
    const topfbert = page.locator('[data-topfbert-idle]')
    await expect(topfbert).toBeVisible()
    await expect.poll(() => topfbert.evaluate(el => el.getAnimations({ subtree: true }).length)).toBeGreaterThan(0)

    await context.unroute(landing)
    await page.getByRole('button', { name: 'Nochmal versuchen' }).click()
    await expect(page).toHaveURL(/\/changelog/)
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
  // Adding works offline (#462): Add Dish opens, with what needs a
  // connection greyed out. Cooking and the card's menu stay, as moving and
  // cooking work offline (#459).
  await expect(add).not.toHaveAttribute('aria-disabled')
  await add.click()
  const adding = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await expect(adding).toBeVisible()
  await adding.getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
  await expect(adding.getByRole('button', { name: 'Bild wählen' })).toBeDisabled()
  await adding.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(adding).toBeHidden()
  await expect(page.getByRole('button', { name: 'Gekocht ✓: „Linsensuppe“' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mehr zu „Linsensuppe“' })).toBeVisible()

  // The Dish's detail opens to read; its other changes are greyed out.
  await page.getByRole('link', { name: 'Linsensuppe' }).click()
  const detail = page.getByRole('dialog', { name: 'Linsensuppe' })
  await expect(detail.getByRole('heading', { name: 'Linsensuppe', level: 1 })).toBeVisible()
  // The title can be edited offline (#460), the Comment field not: its History never loaded.
  await expect(detail.getByRole('button', { name: 'Bearbeiten' }).first()).not.toHaveAttribute('aria-disabled')
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

// Unsent Changes (#459): offline, a Dish can be moved and cooked. Each shows
// at once, the bar counts them, and once the connection is back they go out
// in order, the bar says "Alles gesendet", and another Member sees both.
// Hroswitha owns the Board, Trotula joins it; both used by this file only.
const HROSWITHA = ALLOWLISTED[202]
const TROTULA = ALLOWLISTED[203]

test('a move and a Gekocht ✓ made offline are counted, sent once back, and reach another Member', async ({ page, browser, context }) => {
  test.slow()
  await removeUsers(HROSWITHA, TROTULA)
  await fastPolls(page)
  await signIn(page, HROSWITHA)
  const res = await page.request.post('/api/boards', { data: { name: 'Offline-Küche', emoji: '🥘' } })
  expect(res.status()).toBe(201)
  const { id: boardId } = await res.json() as { id: string }
  for (const title of ['Linsensuppe', 'Pasta']) {
    expect((await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title, placeholder: 'bowl' } })).status()).toBe(201)
  }
  const token = await inviteToken(page, boardId)

  const other = await newTab(browser)
  await fastPolls(other)
  await signIn(other, TROTULA)
  expect((await other.request.post(`/api/invites/${token}/join`, { headers: { origin: E2E_ORIGIN } })).status()).toBe(200)
  await gotoHydrated(other, `/b/${boardId}`)
  await gotoHydrated(page, `/b/${boardId}`)
  await expect(titles(other, 'Ideen')).toHaveText(['Pasta', 'Linsensuppe'])

  await context.setOffline(true)
  await expect(offlineBar(page)).toBeVisible()

  // Moved with "Verschieben nach…" and cooked with "Gekocht ✓": both show at
  // once, and offline they are not greyed out.
  await page.getByRole('button', { name: 'Mehr zu „Linsensuppe“' }).click()
  const menu = page.getByRole('dialog', { name: 'Linsensuppe' })
  await menu.getByRole('button', { name: 'Verschieben nach…' }).click()
  await menu.getByRole('button', { name: 'Diese Woche' }).click()
  await expect(titles(page, 'Diese Woche')).toHaveText(['Linsensuppe'])
  await page.getByRole('button', { name: 'Gekocht ✓: „Pasta“' }).click()
  await expect(titles(page, 'Gekocht')).toHaveText(['Pasta'])

  await expect(bar(page, '2 noch nicht gesendet')).toBeVisible()
  await expect(titles(other, 'Gekocht')).toHaveCount(0)

  await context.setOffline(false)

  await expect(bar(page, 'Alles gesendet')).toBeVisible({ timeout: 15_000 })
  await expect(titles(other, 'Diese Woche')).toHaveText(['Linsensuppe'], { timeout: 15_000 })
  await expect(titles(other, 'Gekocht')).toHaveText(['Pasta'], { timeout: 15_000 })
  await expect(bar(page, 'Alles gesendet')).toBeHidden({ timeout: 10_000 })
  // Still there for the one who made them.
  await expect(titles(page, 'Diese Woche')).toHaveText(['Linsensuppe'])
  await expect(titles(page, 'Gekocht')).toHaveText(['Pasta'])
})

// Opening malkochen offline (#461): every Board opened on the device is kept
// on it, and the service worker keeps the app itself, so the installed app or
// the browser opens on the last Board with no connection, cold. Hildegard,
// Hroswitha and Trotula are cleaned with `removeUsers` first, so these start
// from nothing.

// What the device keeps (device-store.ts): the keys of one of its stores, read
// from the page's own IndexedDB.
async function kept(page: Page, store: 'boards' | 'listings' | 'histories' | 'user' | 'addresses' | 'last' | 'unsent'): Promise<string[]> {
  return page.evaluate(name => new Promise<string[]>((resolve) => {
    const open = indexedDB.open('malkochen')
    open.onerror = () => resolve([])
    open.onsuccess = () => {
      const db = open.result
      if (!db.objectStoreNames.contains(name)) {
        db.close()
        resolve([])
        return
      }
      const request = db.transaction(name).objectStore(name).getAllKeys()
      request.onsuccess = () => {
        db.close()
        // The keys are the user's id, a NUL and the item's: the item's.
        resolve(request.result.map(key => String(key).split('\u0000').pop()!))
      }
      request.onerror = () => {
        db.close()
        resolve([])
      }
    }
  }), store)
}

async function createBoard(page: Page, name: string, dishes: string[] = []) {
  const res = await page.request.post('/api/boards', { data: { name, emoji: '🥘' } })
  expect(res.status()).toBe(201)
  const board = await res.json() as { id: string, slug: string }
  for (const title of dishes) {
    expect((await page.request.post(`/api/boards/${board.id}/dishes`, { data: { title, placeholder: 'bowl' } })).status()).toBe(201)
  }
  return board
}

test('a Board opened on the device opens cold offline, its Dish and the switcher too, with an Unsent Change kept through a reload', async ({ page, context }) => {
  test.slow()
  // The app keeps the files of the pages it opens offline (the start, the
  // share target) as soon as the worker is in control, not only the ones this
  // test visits: the development server's hundreds of files make that too slow
  // for every test, so it is asked for here.
  await page.addInitScript(() => {
    (window as { e2eSeedOffline?: boolean }).e2eSeedOffline = true
  })
  await removeUsers(HILDEGARD)
  await signIn(page, HILDEGARD)
  const board = await createBoard(page, 'Kochclub Offline', ['Linsensuppe', 'Pasta'])
  const never = await createBoard(page, 'Nie geöffnet')

  // Opened online: kept. The worker takes control, and the reload sends the
  // app's files through it. A Dish's detail is opened too, for its History.
  await gotoHydrated(page, `/b/${board.slug}`)
  await serviceWorkerInControl(page)
  await reloadHydrated(page)
  await page.getByRole('link', { name: 'Linsensuppe' }).click()
  const detail = page.getByRole('dialog', { name: 'Linsensuppe' })
  await expect(detail.getByRole('heading', { name: 'Linsensuppe', level: 1 })).toBeVisible()
  const dishUrl = page.url()
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(detail).toBeHidden()
  await expect.poll(() => kept(page, 'boards')).toHaveLength(1)
  await expect.poll(() => kept(page, 'listings')).toHaveLength(1)
  await expect.poll(() => kept(page, 'histories')).toHaveLength(1)
  await expect.poll(() => kept(page, 'user')).toHaveLength(1)
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('assets-v1')).keys()).some(request => request.url.includes('/pages/share.vue')))).toBe(true)

  // The app opened cold with no connection starts on that Board.
  await context.setOffline(true)
  await page.goto('/')
  await expect(page).toHaveURL(new RegExp(`/b/${board.slug}$`))
  await expect(titles(page, 'Ideen')).toHaveText(['Pasta', 'Linsensuppe'])
  await expect(offlineBar(page)).toBeVisible()

  // Its Address, and a Dish's, open it from the device.
  await page.goto(`/b/${board.slug}`)
  await expect(titles(page, 'Ideen')).toHaveText(['Pasta', 'Linsensuppe'])
  await page.goto(dishUrl)
  const offlineDetail = page.getByRole('dialog', { name: 'Linsensuppe' })
  await expect(offlineDetail.getByRole('heading', { name: 'Linsensuppe', level: 1 })).toBeVisible()
  // Its History was kept, and opening it offline doesn't open it.
  await expect(offlineDetail.locator('[data-dish-history]')).toBeVisible()
  await offlineDetail.getByRole('button', { name: 'Schließen' }).first().click()

  // An Unsent Change made now is still there after a reload, offline.
  await page.getByRole('button', { name: 'Gekocht ✓: „Pasta“' }).click()
  await expect(titles(page, 'Gekocht')).toHaveText(['Pasta'])
  await expect(bar(page, '1 noch nicht gesendet')).toBeVisible()
  await page.reload()
  await expect(titles(page, 'Gekocht')).toHaveText(['Pasta'])
  await expect(titles(page, 'Ideen')).toHaveText(['Linsensuppe'])
  await expect(bar(page, '1 noch nicht gesendet')).toBeVisible()

  // The switcher lists the Boards kept here, not the one never opened.
  await page.getByRole('button', { name: /Board wechseln/ }).click()
  const panel = page.getByRole('navigation', { name: 'Deine Boards' })
  await expect(panel.getByRole('link', { name: /Kochclub Offline/ }).first()).toBeVisible()
  await expect(panel.getByRole('link', { name: /Nie geöffnet/ })).toHaveCount(0)

  // A Board never opened here says it needs a connection; any other page
  // gets the Offline page.
  await page.goto(`/b/${never.slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Das braucht Netz.')
  await page.goto(NOT_KEPT)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Du bist offline.')

  // Back online, the Unsent Change goes out from the Board it was made on.
  await context.setOffline(false)
  await expect(page.getByRole('heading', { name: 'Was ist neu', level: 1 })).toBeVisible()
  await gotoHydrated(page, `/b/${board.slug}`)
  await expect(bar(page, 'Alles gesendet')).toBeVisible({ timeout: 15_000 })
  await expect.poll(async () => {
    const served = await (await page.request.get(`/api/boards/${board.id}`)).json() as { columns: { isGekocht: boolean, dishes: { title: string }[] }[] }
    return served.columns.find(c => c.isGekocht)!.dishes.map(d => d.title)
  }).toEqual(['Pasta'])
})

test('a Board left is removed from the device the next time online, and signing out removes all of it', async ({ page, browser }) => {
  test.slow()
  await removeUsers(HROSWITHA, TROTULA)
  await signIn(page, HROSWITHA)
  const board = await createBoard(page, 'Verlassen', ['Brot'])
  const token = await inviteToken(page, board.id)

  const member = await newTab(browser)
  await signIn(member, TROTULA)
  expect((await member.request.post(`/api/invites/${token}/join`, { headers: { origin: E2E_ORIGIN } })).status()).toBe(200)
  await gotoHydrated(member, `/b/${board.slug}`)
  await expect.poll(() => kept(member, 'boards')).toContain(board.id)
  await expect.poll(() => kept(member, 'listings')).toHaveLength(1)

  // They leave it; the next time a Board loads with a connection, it is gone
  // from the device.
  const me = await (await member.request.get('/api/me')).json() as { id: string }
  expect((await member.request.delete(`/api/boards/${board.id}/members/${me.id}`, { headers: { origin: E2E_ORIGIN } })).status()).toBe(204)
  await gotoHydrated(member, '/')
  await expect.poll(() => kept(member, 'boards')).not.toContain(board.id)

  // Signing out removes everything kept, the user included.
  await expect.poll(() => kept(member, 'boards')).toHaveLength(1)
  await member.getByRole('button', { name: 'Dein Konto' }).click()
  await member.getByRole('menuitem', { name: 'Abmelden' }).click()
  await expect(member).toHaveURL(/\/login/)
  for (const store of ['boards', 'listings', 'histories', 'user', 'last', 'addresses', 'unsent'] as const) {
    await expect.poll(() => kept(member, store)).toEqual([])
  }
  expect(await member.evaluate(() => caches.has('images-v1'))).toBe(false)
  await member.context().close()
})

// Comments and title edits offline (#460): a Comment is only offered on a
// Dish whose Dish History has loaded; the title is the one field of the edit
// form that works offline.
async function boardWithTwoMembers(page: Page, browser: Parameters<typeof newTab>[0]) {
  await removeUsers(HROSWITHA, TROTULA)
  await fastPolls(page)
  await signIn(page, HROSWITHA)
  const res = await page.request.post('/api/boards', { data: { name: 'Offline-Küche', emoji: '🥘' } })
  expect(res.status()).toBe(201)
  const { id: boardId } = await res.json() as { id: string }
  for (const title of ['Linsensuppe', 'Pasta']) {
    expect((await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title, placeholder: 'bowl' } })).status()).toBe(201)
  }
  const token = await inviteToken(page, boardId)
  const other = await newTab(browser)
  await fastPolls(other)
  await signIn(other, TROTULA)
  expect((await other.request.post(`/api/invites/${token}/join`, { headers: { origin: E2E_ORIGIN } })).status()).toBe(200)
  await gotoHydrated(other, `/b/${boardId}`)
  await gotoHydrated(page, `/b/${boardId}`)
  await expect(titles(other, 'Ideen')).toHaveText(['Pasta', 'Linsensuppe'])
  return { boardId, other }
}

test('a Comment written offline on a Dish whose History was loaded reaches another Member; on one whose History was not, Comments are greyed out', async ({ page, browser, context }) => {
  test.slow()
  const { other } = await boardWithTwoMembers(page, browser)

  // Linsensuppe's History loads while online.
  await page.getByRole('link', { name: 'Linsensuppe' }).click()
  const soup = page.getByRole('dialog', { name: 'Linsensuppe' })
  await expect(soup.getByRole('textbox', { name: 'Kommentar' })).toBeEnabled()
  await soup.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(soup).toBeHidden()

  await context.setOffline(true)
  await expect(offlineBar(page)).toBeVisible()

  // Pasta's never did: its comment field is greyed out.
  await page.getByRole('link', { name: 'Pasta' }).click()
  const pasta = page.getByRole('dialog', { name: 'Pasta' })
  await expect(pasta.getByRole('textbox', { name: 'Kommentar' })).toBeDisabled()
  await pasta.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(pasta).toBeHidden()

  await page.getByRole('link', { name: 'Linsensuppe' }).click()
  const field = soup.getByRole('textbox', { name: 'Kommentar' })
  await expect(field).toBeEnabled()
  await field.fill('Mit mehr Zitrone')
  await soup.getByRole('button', { name: 'Senden' }).click()
  await expect(soup.locator('[data-comment]')).toHaveText(/Mit mehr Zitrone/)
  await expect(bar(page, '1 noch nicht gesendet')).toBeVisible()

  await context.setOffline(false)
  await expect(bar(page, 'Alles gesendet')).toBeVisible({ timeout: 15_000 })
  await expect(soup.locator('[data-comment]')).toHaveText(/Mit mehr Zitrone/)

  await other.getByRole('link', { name: 'Linsensuppe' }).click()
  const theirs = other.getByRole('dialog', { name: 'Linsensuppe' })
  await expect(theirs.locator('[data-comment]')).toHaveText(/Mit mehr Zitrone/, { timeout: 15_000 })
  await expect(theirs.locator('[data-comment]')).toHaveCount(1)
})

test('a title edited offline shows at once, the rest of the form is greyed out, and the title reaches another Member', async ({ page, browser, context }) => {
  test.slow()
  const { other } = await boardWithTwoMembers(page, browser)

  await context.setOffline(true)
  await expect(offlineBar(page)).toBeVisible()
  await page.getByRole('link', { name: 'Pasta' }).click()
  const detail = page.getByRole('dialog', { name: 'Pasta' })
  await detail.getByRole('button', { name: 'Bearbeiten' }).first().click()

  await expect(detail.getByLabel('Titel')).toBeEnabled()
  await expect(detail.getByLabel('Link')).toBeDisabled()
  await expect(detail.getByRole('button', { name: 'Bild wählen' })).toBeDisabled()
  await detail.getByLabel('Titel').fill('Pasta al limone')
  await detail.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.getByRole('dialog', { name: 'Pasta al limone' }).getByRole('heading', { level: 1 })).toHaveText('Pasta al limone')
  await expect(bar(page, '1 noch nicht gesendet')).toBeVisible()
  await expect(titles(other, 'Ideen')).toHaveText(['Pasta', 'Linsensuppe'])

  await context.setOffline(false)
  await expect(bar(page, 'Alles gesendet')).toBeVisible({ timeout: 15_000 })
  await expect(titles(other, 'Ideen')).toHaveText(['Pasta al limone', 'Linsensuppe'], { timeout: 15_000 })
})

// Adding a Dish offline (#462): from a link, with or without a title, or by
// hand. It shows at once, marked "Noch nicht gesendet", with the Placeholder
// Image and the link's site; the server looks the link up once it arrives
// (the test server knows the links in tests/support/source-lookup-fixtures.ts).
test('a Dish added offline by link without a title shows at once and marked, and once back it is looked up and reaches another Member', async ({ page, browser, context }) => {
  test.slow()
  const { other } = await boardWithTwoMembers(page, browser)

  await context.setOffline(true)
  await expect(offlineBar(page)).toBeVisible()
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await sheet.getByLabel('Link').fill(PASTA_TIKTOK)

  // Nothing is looked up; a title is optional; what needs a connection is greyed out.
  await expect(sheet.getByText('Kein Netz. Der Link wird nachgeschaut, sobald wieder Netz da ist.')).toBeVisible()
  await expect(sheet.getByLabel('Titel (kann leer bleiben)')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Bild wählen' })).toBeDisabled()
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(sheet).toBeHidden()

  await expect(titles(page, 'Ideen')).toHaveText(['tiktok.com', 'Pasta', 'Linsensuppe'])
  const unsentCard = page.getByRole('article', { name: 'tiktok.com' })
  await expect(unsentCard.getByText('Noch nicht gesendet')).toBeVisible()
  await expect(unsentCard.locator('[data-dish-image]')).toHaveCount(0)
  await expect(bar(page, '1 noch nicht gesendet')).toBeVisible()
  await expect(titles(other, 'Ideen')).toHaveText(['Pasta', 'Linsensuppe'])

  await context.setOffline(false)

  await expect(bar(page, 'Alles gesendet')).toBeVisible({ timeout: 15_000 })
  await expect(titles(page, 'Ideen')).toHaveText(['Cremige Pilzpasta', 'Pasta', 'Linsensuppe'])
  const arrived = page.getByRole('article', { name: 'Cremige Pilzpasta' })
  await expect(arrived.getByText('Noch nicht gesendet')).toHaveCount(0)
  await expect(arrived.getByText('@mara.kocht')).toBeVisible()
  await expect(arrived.locator('[data-dish-image]')).toHaveAttribute('src', /\/images\/dishes\//)
  await expect(titles(other, 'Ideen')).toHaveText(['Cremige Pilzpasta', 'Pasta', 'Linsensuppe'], { timeout: 15_000 })
})

test('a Dish shared to malkochen cold and offline opens Add Dish with the link filled in, is kept through a reload, and is added once back', async ({ page, context }) => {
  test.slow()
  await page.addInitScript(() => {
    (window as { e2eSeedOffline?: boolean }).e2eSeedOffline = true
  })
  await removeUsers(HILDEGARD)
  await signIn(page, HILDEGARD)
  const board = await createBoard(page, 'Kochclub Teilen', ['Linsensuppe'])
  await gotoHydrated(page, `/b/${board.slug}`)
  await serviceWorkerInControl(page)
  await reloadHydrated(page)
  await expect.poll(() => kept(page, 'boards')).toHaveLength(1)
  await expect.poll(() => kept(page, 'user')).toHaveLength(1)
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('assets-v1')).keys()).some(request => request.url.includes('/pages/share.vue')))).toBe(true)

  await context.setOffline(true)
  await page.goto(`/share?${new URLSearchParams({ title: 'Video', text: 'Schau mal', url: REEL })}`)
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByLabel('Link')).toHaveValue(REEL)
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(titles(page, 'Ideen')).toHaveText(['instagram.com', 'Linsensuppe'])
  await expect(bar(page, '1 noch nicht gesendet')).toBeVisible()

  await page.reload()
  await expect(titles(page, 'Ideen')).toHaveText(['instagram.com', 'Linsensuppe'])
  await expect(page.getByRole('article', { name: 'instagram.com' }).getByText('Noch nicht gesendet')).toBeVisible()

  await context.setOffline(false)
  await gotoHydrated(page, `/b/${board.slug}`)
  await expect(bar(page, 'Alles gesendet')).toBeVisible({ timeout: 15_000 })
  await expect(titles(page, 'Ideen')).toHaveText(['Instagram-Reel von mara.kocht', 'Linsensuppe'])
})

test('with reduced motion the Offline page shows its clip still',async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page)
  await gotoHydrated(page, '/')
  await serviceWorkerInControl(page)

  await context.setOffline(true)
  await page.goto(NOT_KEPT)
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
    await page.goto(NOT_KEPT)
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
