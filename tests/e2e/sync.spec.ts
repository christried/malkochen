import type { Browser, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column, titles } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'

// Sync between Members and "Neu" markers (PRD stories 37, 38): others'
// changes show up while the Board is open, by polling and when the app
// comes back to the front. Alan owns the Boards; Dorothy joins them. Among
// the browser tests, both are used by this file only.

const ALAN = ALLOWLISTED[15]
const DOROTHY = ALLOWLISTED[16]

// A new Board of Alan's that Dorothy has joined, and her browser, signed in.
async function sharedBoard(page: Page, browser: Browser, name: string): Promise<{ boardId: string, dorothy: Page }> {
  await signIn(page, ALAN)
  const res = await page.request.post('/api/boards', { data: { name, emoji: '🥘' } })
  expect(res.status()).toBe(201)
  const { id: boardId } = await res.json() as { id: string }
  const token = await inviteToken(page, boardId)

  const dorothy = await newTab(browser)
  await signIn(dorothy, DOROTHY)
  expect((await dorothy.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  return { boardId, dorothy }
}

async function addDish(page: Page, boardId: string, title: string): Promise<string> {
  const res = await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title, placeholder: 'curry' } })
  expect(res.status()).toBe(201)
  return (await res.json()).id
}

function card(page: Page, columnName: string, title: string) {
  return column(page, columnName).getByRole('article', { name: title })
}

// Pretends the tab went to the background or came back, as a phone
// switching apps does.
async function setVisibility(page: Page, state: 'visible' | 'hidden') {
  await page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

test('another Member\'s new Dish, edit and move show up without a reload, their Dish marked "Neu"', async ({ page, browser }) => {
  const { boardId, dorothy } = await sharedBoard(page, browser, 'Kochclub')
  await addDish(page, boardId, 'Alans Auflauf')
  await gotoHydrated(page, `/b/${boardId}`)

  const dishId = await addDish(dorothy, boardId, 'Dorothys Dal')
  await expect(titles(page, 'Ideen')).toHaveText(['Dorothys Dal', 'Alans Auflauf'], { timeout: 10_000 })
  await expect(card(page, 'Ideen', 'Dorothys Dal').getByText('Neu')).toBeVisible()
  await expect(card(page, 'Ideen', 'Alans Auflauf').getByText('Neu')).toHaveCount(0)

  expect((await dorothy.request.patch(`/api/dishes/${dishId}`, { data: { title: 'Dorothys Linsen-Dal' } })).status()).toBe(200)
  await expect(titles(page, 'Ideen')).toHaveText(['Dorothys Linsen-Dal', 'Alans Auflauf'], { timeout: 10_000 })

  const gekocht = await (await dorothy.request.get(`/api/boards/${boardId}`)).json() as { columns: { id: string, isGekocht: boolean }[] }
  const gekochtId = gekocht.columns.find(c => c.isGekocht)!.id
  expect((await dorothy.request.post(`/api/dishes/${dishId}/move`, { data: { columnId: gekochtId } })).status()).toBe(200)
  await expect(titles(page, 'Gekocht')).toHaveText(['Dorothys Linsen-Dal'], { timeout: 10_000 })
  await expect(titles(page, 'Ideen')).toHaveText(['Alans Auflauf'])
})

test('another Member’s change to a Dish’s Creator shows up without a reload, and so does clearing it', async ({ page, browser }) => {
  const { boardId, dorothy } = await sharedBoard(page, browser, 'Kochclub')
  const dishId = await addDish(page, boardId, 'Alans Auflauf')
  await gotoHydrated(page, `/b/${boardId}`)
  const creator = card(page, 'Ideen', 'Alans Auflauf').locator('[data-creator]')
  await expect(creator).toHaveCount(0)

  expect((await dorothy.request.patch(`/api/dishes/${dishId}`, { data: { creator: 'Love and Lemons' } })).status()).toBe(200)
  await expect(creator).toHaveText('Veröffentlicht von Love and Lemons', { timeout: 10_000 })

  expect((await dorothy.request.patch(`/api/dishes/${dishId}`, { data: { creator: '' } })).status()).toBe(200)
  await expect(creator).toHaveCount(0, { timeout: 10_000 })
})

test('another Member’s change to a Column Subtitle shows up without a reload', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const { boardId, dorothy } = await sharedBoard(page, browser, 'Kochclub')
  await gotoHydrated(page, `/b/${boardId}`)
  const subtitle = column(page, 'Ideen').locator('[data-column-subtitle]')
  await expect(subtitle).toHaveText('Worauf hast du Lust?')

  const { columns } = await (await dorothy.request.get(`/api/boards/${boardId}`)).json() as { columns: { id: string }[] }
  expect((await dorothy.request.patch(`/api/columns/${columns[0]!.id}`, { data: { subtitle: 'Irgendwann mal' } })).status()).toBe(200)
  await expect(subtitle).toHaveText('Irgendwann mal', { timeout: 10_000 })

  expect((await dorothy.request.patch(`/api/columns/${columns[0]!.id}`, { data: { subtitle: null } })).status()).toBe(200)
  await expect(subtitle).toHaveCount(0, { timeout: 10_000 })
})

test('polling stops while the Board is in the background, and coming back refreshes it at once', async ({ page, browser }) => {
  const { boardId, dorothy } = await sharedBoard(page, browser, 'Suppenküche')
  await gotoHydrated(page, `/b/${boardId}`)
  await setVisibility(page, 'hidden')

  await addDish(dorothy, boardId, 'Linsensuppe')
  // Longer than the polling interval: nothing arrives while hidden.
  await page.waitForTimeout(7_000)
  await expect(titles(page, 'Ideen')).toHaveCount(0)

  await setVisibility(page, 'visible')
  await expect(titles(page, 'Ideen')).toHaveText(['Linsensuppe'], { timeout: 2_000 })
})

test('a desktop window coming back to the front refreshes the Board at once', async ({ page, browser }) => {
  const { boardId, dorothy } = await sharedBoard(page, browser, 'Teeküche')
  await gotoHydrated(page, `/b/${boardId}`)
  // Just polled: the next poll is a few seconds off.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.waitForTimeout(500)

  await addDish(dorothy, boardId, 'Chai')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(titles(page, 'Ideen')).toHaveText(['Chai'], { timeout: 2_000 })
})

// The titles of the Ideen Dishes marked "Neu", in any order.
async function newTitles(page: Page): Promise<string[]> {
  const cards = column(page, 'Ideen').getByRole('article').filter({ has: page.locator('[data-neu]') })
  return (await cards.evaluateAll(els => els.map(el => el.getAttribute('aria-label') ?? ''))).toSorted()
}

const AWAY = ['Shakshuka', 'Ofengemüse', 'Bohneneintopf']

test('every Dish another Member added while I was away is "Neu" when I open the Board; opening it again clears them all', async ({ page, browser }) => {
  const { boardId, dorothy } = await sharedBoard(page, browser, 'Wochenmarkt')
  await gotoHydrated(page, `/b/${boardId}`)
  await page.goto('/settings')

  for (const title of AWAY) await addDish(dorothy, boardId, title)
  await gotoHydrated(page, `/b/${boardId}`)
  await expect(titles(page, 'Ideen')).toHaveCount(3)
  await expect.poll(() => newTitles(page)).toEqual(AWAY.toSorted())

  await reloadHydrated(page)
  await expect(titles(page, 'Ideen')).toHaveCount(3)
  await expect(column(page, 'Ideen').locator('[data-neu]')).toHaveCount(0)
})

// Lets the open Board's next poll go out (page.clock installed) and come back.
async function nextPoll(page: Page) {
  const seen = page.waitForResponse(res => res.url().endsWith('/seen') && res.ok())
  await page.clock.runFor(6_000)
  await seen
}

// Alan has the Board open with one New Dish of Dorothy's, then the app goes
// to the background; a stray focus comes while it is there.
async function goAway(page: Page, dorothy: Page, boardId: string) {
  await addDish(dorothy, boardId, 'Linsencurry')
  await page.clock.install()
  await gotoHydrated(page, `/b/${boardId}`)
  await expect.poll(() => newTitles(page)).toEqual(['Linsencurry'])
  await setVisibility(page, 'hidden')
  await page.clock.fastForward('01:00')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
}

const focus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('focus')))

// Coming back to the app, a phone may tell the page it has the focus before
// it says it is visible again, or after.
for (const focusFirst of [false, true]) {
  test(`coming back to the open Board after half an hour away marks every Dish added meanwhile "Neu", and only those; opening it again clears them all (focus ${focusFirst ? 'before' : 'after'} visible)`, async ({ page, browser }) => {
    const { boardId, dorothy } = await sharedBoard(page, browser, focusFirst ? 'Gemüsekiste' : 'Obstkorb')
    await goAway(page, dorothy, boardId)

    for (const title of AWAY) await addDish(dorothy, boardId, title)
    await page.clock.fastForward('30:00')
    if (focusFirst) await focus(page)
    await setVisibility(page, 'visible')
    if (!focusFirst) await focus(page)
    await expect(titles(page, 'Ideen')).toHaveCount(4, { timeout: 5_000 })
    // Linsencurry was seen before going away: no longer "Neu".
    await expect.poll(() => newTitles(page)).toEqual(AWAY.toSorted())
    // They stay "Neu" while the Board is open: past the next poll too.
    await nextPoll(page)
    expect(await newTitles(page)).toEqual(AWAY.toSorted())

    await reloadHydrated(page)
    await expect(titles(page, 'Ideen')).toHaveCount(4)
    await expect(column(page, 'Ideen').locator('[data-neu]')).toHaveCount(0)
  })
}

test('coming back after half an hour while still offline reopens the Board once it can', async ({ page, browser }) => {
  const { boardId, dorothy } = await sharedBoard(page, browser, 'Vorratskammer')
  await goAway(page, dorothy, boardId)
  for (const title of AWAY) await addDish(dorothy, boardId, title)
  await page.clock.fastForward('30:00')

  // The first reopen fails, as a phone's network may still be waking up.
  let failed = false
  await page.route('**/api/boards/*/open', (route) => {
    if (failed) return route.continue()
    failed = true
    return route.abort()
  })
  await setVisibility(page, 'visible')
  await expect.poll(() => failed).toBe(true)

  await nextPoll(page)
  await expect(titles(page, 'Ideen')).toHaveCount(4)
  await expect.poll(() => newTitles(page)).toEqual(AWAY.toSorted())
})

test('a Dish open in the detail that another Member deletes closes it and says so', async ({ page, browser }) => {
  const { boardId, dorothy } = await sharedBoard(page, browser, 'Resteessen')
  const dishId = await addDish(dorothy, boardId, 'Bratreis')
  await gotoHydrated(page, `/b/${boardId}/d/${dishId}`)
  await expect(page.getByRole('dialog', { name: 'Bratreis' })).toBeVisible()

  expect((await dorothy.request.delete(`/api/dishes/${dishId}`)).status()).toBe(204)

  await expect(page.getByRole('dialog', { name: 'Bratreis' })).toHaveCount(0, { timeout: 10_000 })
  await expect(page.getByText('„Bratreis“ ist nicht mehr auf diesem Board.')).toBeVisible()
  const { slug } = await (await page.request.get(`/api/boards/${boardId}`)).json() as { slug: string }
  await expect(page).toHaveURL(new RegExp(`/b/${slug}$`))
})
