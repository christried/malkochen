import type { Browser, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { startAnthropicService, type AnthropicService } from '../support/anthropic-service'
import { RECIPE_TIKTOK } from '../support/source-lookup-fixtures'
import { E2E_ORIGIN, OPERATOR } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { fastPolls } from './polls'
import { removeUsers } from './seed'

// The Recipe Finder in the Dish detail (spec #492, ticket #504): "Rezept
// finden" on a Dish with a Source and no Recipe, the search card every Member
// sees, and what a search ends in. Anthropic is the stand-in
// (anthropic-service.ts); the Source is the TikTok fixture whose Caption
// holds a recipe. Marcella has the Recipe Finder (the Operator switches it
// on), Nigella is a Member of her Boards without it; both are used by this
// file only.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

const FINDER_USER = 'marcella@example.com'
const MEMBER = 'nigella@example.com'

const RECIPE = {
  ingredients: ['250 g rote Linsen', '1 Zwiebel', '800 ml Brühe'],
  steps: ['Die Zwiebel anbraten.', 'Linsen und Brühe dazu und 15 Minuten köcheln lassen.'],
}

let anthropic: AnthropicService

test.beforeAll(async () => {
  anthropic = await startAnthropicService()
  await removeUsers(FINDER_USER, MEMBER)
})

test.afterAll(async () => {
  await anthropic.close()
})

// Every test starts with the stand-in answering "no recipe", at once.
test.beforeEach(() => anthropic.forget())

// The Operator switches the Recipe Finder on or off for the signed-in user.
async function switchFinder(page: Page, browser: Browser, on: boolean) {
  const { id } = await (await page.request.get('/api/me')).json() as { id: string }
  const operator = await newTab(browser)
  try {
    await signIn(operator, OPERATOR)
    const res = await operator.request.put(`/api/admin/recipe-finder/${id}`, { data: { on }, headers: { origin: E2E_ORIGIN } })
    expect(res.status()).toBe(200)
  }
  finally {
    await operator.context().close()
  }
}

// A new Board of the Finder user's with a Dish for each title, added the way
// the app adds one (Source Lookup reads the link, its ticket vouches for the
// Caption). The Recipe Finder is off while they are added, as a Dish a user
// with it adds is searched by itself (#503), and on after.
async function boardWithDishes(page: Page, browser: Browser, titles: string[]) {
  await signIn(page, FINDER_USER)
  await switchFinder(page, browser, false)
  const created = await page.request.post('/api/boards', { data: { name: 'Rezeptsuche', emoji: '🥘' } })
  expect(created.status()).toBe(201)
  const { id: boardId } = await created.json() as { id: string }
  for (const title of titles) {
    const lookedUp = await page.request.get(`/api/source-lookup?link=${encodeURIComponent(RECIPE_TIKTOK)}`)
    expect(lookedUp.status()).toBe(200)
    const read = await lookedUp.json() as { canonicalLink: string, kind: string, caption: string | null, sourceTicket: string }
    const res = await page.request.post(`/api/boards/${boardId}/dishes`, {
      data: { title, placeholder: 'bowl', source: { link: read.canonicalLink, kind: read.kind }, caption: read.caption, sourceTicket: read.sourceTicket },
    })
    expect(res.status(), await res.text()).toBe(201)
  }
  await switchFinder(page, browser, true)
  return boardId
}

async function openDish(page: Page, boardId: string, title: string) {
  await gotoHydrated(page, `/b/${boardId}`)
  await page.getByRole('link', { name: title, exact: true }).click()
  const detail = page.getByRole('dialog', { name: title })
  await expect(detail).toBeVisible()
  return detail
}

test('"Rezept finden" ends in a Recipe in the open detail, which is edited like any other', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 360, height: 800 })
  const boardId = await boardWithDishes(page, browser, ['Linsensuppe'])
  anthropic.answer(RECIPE)
  anthropic.slowBy(2500)
  const detail = await openDish(page, boardId, 'Linsensuppe')

  // Both buttons, side by side or stacked, of one size.
  const find = detail.getByRole('button', { name: 'Rezept finden' })
  const add = detail.getByRole('button', { name: 'Rezept hinzufügen' })
  await expect(find).toBeEnabled()
  await expect(add).toBeVisible()
  expect((await find.boundingBox())!.height).toBe((await add.boundingBox())!.height)
  expect((await find.boundingBox())!.width).toBe((await add.boundingBox())!.width)

  const scrolled = await detail.evaluate(el => el.scrollTop)
  await find.click()

  // The search card is there for as long as it runs; "Rezept hinzufügen" waits.
  const searching = detail.locator('[data-recipe-searching]')
  await expect(searching).toBeVisible()
  await expect(searching).toHaveAttribute('role', 'status')
  await expect(searching).toContainText('Rezept wird gesucht')
  await expect(searching).toContainText('Das dauert meist ein paar Sekunden, manchmal auch eine halbe Minute.')
  await expect(detail.getByRole('button', { name: 'Rezept hinzufügen' })).toHaveCount(0)
  await expect(detail.getByRole('button', { name: 'Rezept finden' })).toHaveCount(0)

  // Then the Recipe, in the detail that stayed open, and the scroll where it was.
  await expect(detail.getByRole('heading', { name: 'Rezept', level: 2 })).toBeVisible({ timeout: 20_000 })
  await expect(detail.locator('[data-recipe-list="ingredients"] [data-recipe-line]')).toHaveText(RECIPE.ingredients)
  await expect(detail.locator('[data-recipe-list="steps"] [data-recipe-line]')).toHaveText(RECIPE.steps.map((step, i) => `${i + 1}${step}`))
  await expect(searching).toHaveCount(0)
  await expect(detail.getByRole('button', { name: 'Rezept finden' })).toHaveCount(0)
  expect(await detail.evaluate(el => el.scrollTop)).toBe(scrolled)

  // A found Recipe edits like any other: its lines are in the editor.
  await detail.locator('[data-recipe-section] [data-edit-recipe]').click()
  const editor = page.getByRole('dialog', { name: 'Rezept' })
  await expect(editor).toBeVisible()
  await expect(editor.getByRole('textbox', { name: 'Zutat 1' })).toHaveValue('250 g rote Linsen')
  await expect(editor.getByRole('textbox', { name: 'Schritt 2' })).toHaveValue(RECIPE.steps[1]!)
})

test('a search that finds nothing says so to the Dish, with "Rezept hinzufügen" and no "Rezept finden", also after a reload', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 360, height: 800 })
  const boardId = await boardWithDishes(page, browser, ['Neues Video'])
  anthropic.answer('empty')
  let detail = await openDish(page, boardId, 'Neues Video')

  await detail.getByRole('button', { name: 'Rezept finden' }).click()

  const note = detail.locator('[data-recipe-note="none"]')
  await expect(note).toContainText('Kein Rezept gefunden', { timeout: 20_000 })
  await expect(note).toContainText('In der Caption und auf der verlinkten Seite stand keins.')
  await expect(detail.getByRole('button', { name: 'Rezept hinzufügen' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Rezept finden' })).toHaveCount(0)
  await expect(detail.locator('[data-recipe-searching]')).toHaveCount(0)

  await reloadHydrated(page)
  detail = page.getByRole('dialog', { name: 'Neues Video' })
  await expect(detail.locator('[data-recipe-note="none"]')).toContainText('Kein Rezept gefunden')
  await expect(detail.getByRole('button', { name: 'Rezept hinzufügen' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Rezept finden' })).toHaveCount(0)
})

test('another Member with the Dish open sees "Rezept wird gesucht" and then the Recipe arrive, without a reload', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 360, height: 800 })
  const boardId = await boardWithDishes(page, browser, ['Linsensuppe'])
  const token = await inviteToken(page, boardId)
  const member = await newTab(browser, { viewport: { width: 360, height: 800 }, colorScheme: 'light' })
  try {
    await fastPolls(member)
    await signIn(member, MEMBER)
    expect((await member.request.post(`/api/invites/${token}/join`, { headers: { origin: E2E_ORIGIN } })).status()).toBe(200)
    const memberDetail = await openDish(member, boardId, 'Linsensuppe')
    // Without the Recipe Finder, they are offered no search of their own.
    await expect(memberDetail.getByRole('button', { name: 'Rezept hinzufügen' })).toBeVisible()
    await expect(memberDetail.getByRole('button', { name: 'Rezept finden' })).toHaveCount(0)

    // The search takes long enough here for the poll to see it run.
    anthropic.answer(RECIPE)
    anthropic.slowBy(5000)
    const detail = await openDish(page, boardId, 'Linsensuppe')
    await detail.getByRole('button', { name: 'Rezept finden' }).click()

    await expect(memberDetail.locator('[data-recipe-searching]')).toContainText('Rezept wird gesucht', { timeout: 10_000 })
    await expect(memberDetail.getByRole('button', { name: 'Rezept hinzufügen' })).toHaveCount(0)
    await expect(memberDetail.locator('[data-recipe-list="ingredients"] [data-recipe-line]')).toHaveText(RECIPE.ingredients, { timeout: 30_000 })
    await expect(memberDetail.locator('[data-recipe-searching]')).toHaveCount(0)
    await expect(memberDetail.getByRole('heading', { name: 'Rezept', level: 2 })).toBeVisible()
  }
  finally {
    await member.context().close()
  }
})

test('a search that failed says so, and "Noch mal suchen" finds the Recipe', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 360, height: 800 })
  const boardId = await boardWithDishes(page, browser, ['Linsensuppe'])
  anthropic.answer(500)
  const detail = await openDish(page, boardId, 'Linsensuppe')

  await detail.getByRole('button', { name: 'Rezept finden' }).click()

  await expect(detail.getByText('Die Suche hat gerade nicht geklappt.')).toBeVisible({ timeout: 40_000 })
  await expect(detail.locator('[data-recipe-note="failed"] img')).toHaveAttribute('src', '/illustrations/topfbert-oops.svg')
  await expect(detail.getByRole('button', { name: 'Rezept hinzufügen' })).toBeVisible()
  anthropic.answer(RECIPE)
  await detail.getByRole('button', { name: 'Noch mal suchen' }).click()

  await expect(detail.locator('[data-recipe-list="ingredients"] [data-recipe-line]')).toHaveText(RECIPE.ingredients, { timeout: 20_000 })
  await expect(detail.getByText('Die Suche hat gerade nicht geklappt.')).toHaveCount(0)
})

test('at the day’s cap a friendly note says why nothing happens, and "Rezept hinzufügen" stays', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 360, height: 800 })
  const boardId = await boardWithDishes(page, browser, ['Linsensuppe'])
  // The cap itself is the API tests'; here the server says it is reached.
  await page.route('**/api/dishes/*/find-recipe', route => route.fulfill({ status: 429, json: { statusMessage: 'Too Many Requests' } }))
  const detail = await openDish(page, boardId, 'Linsensuppe')

  await detail.getByRole('button', { name: 'Rezept finden' }).click()

  const note = detail.locator('[data-recipe-note="quota"]')
  await expect(note).toContainText('Für heute hat der Rezeptfinder genug gesucht. Morgen sucht er weiter.')
  await expect(note.locator('img')).toHaveAttribute('src', '/illustrations/topfbert-sleep.svg')
  await expect(detail.getByRole('button', { name: 'Rezept hinzufügen' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Rezept finden' })).toHaveCount(0)
  await expect(detail.locator('[data-recipe-searching]')).toHaveCount(0)
})

test('without a connection "Rezept finden" is disabled, and works again once it is back', async ({ page, browser, context }) => {
  test.slow()
  await page.setViewportSize({ width: 360, height: 800 })
  const boardId = await boardWithDishes(page, browser, ['Linsensuppe'])
  const detail = await openDish(page, boardId, 'Linsensuppe')
  const find = detail.getByRole('button', { name: 'Rezept finden' })
  await expect(find).toBeEnabled()

  await context.setOffline(true)
  await expect(find).toBeDisabled()
  await expect(detail.getByRole('button', { name: 'Rezept hinzufügen' })).toBeEnabled()

  await context.setOffline(false)
  await expect(find).toBeEnabled()
})
