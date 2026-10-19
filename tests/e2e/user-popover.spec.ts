import type { Locator, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { cardAtRest, column } from './board'
import { gotoHydrated } from './hydration'
import { inviteToken } from './invite'
import { landingBoardId, removeUsers, resetBoard, seedDish } from './seed'

// The user popover (#213): hovering (computer) or tapping (phone) a Member's
// Profile Picture on a Dish card, or who added it in the Dish detail, shows
// their Username, a large picture, the Boards both share, how many Dishes
// they added to this Board and since when they are on malkochen. Hamilton's
// Boards are used by this file only; Johnson shares two of them and has one
// of her own.
test.describe.configure({ mode: 'serial' })

const HAMILTON = ALLOWLISTED[63]
const JOHNSON = ALLOWLISTED[64]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
// Since this month: both accounts are made by this file.
const SINCE = `dabei seit ${new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date())}`

function popover(page: Page) {
  return page.locator('[data-person-popover]')
}

function card(page: Page, title: string) {
  return column(page, 'Ideen').getByRole('listitem').filter({ has: page.getByRole('link', { name: title, exact: true }) })
}

function personButton(page: Page, title: string) {
  return card(page, title).getByRole('button', { name: /^Hinzugefügt von / })
}

// Fully on the screen.
async function expectOnScreen(page: Page, el: Locator) {
  const box = (await el.boundingBox())!
  const { width, height } = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(width)
  expect(box.y + box.height).toBeLessThanOrEqual(height)
}

async function expectJohnson(page: Page) {
  const shown = popover(page)
  await expect(shown).toBeVisible()
  await expect(shown.getByText('Johnson', { exact: true })).toBeVisible()
  await expect(shown.getByText(SINCE, { exact: true })).toBeVisible()
  await expect(shown.getByText('2 Gerichte hinzugefügt', { exact: true })).toBeVisible()
  await expect(shown.getByText('Gemeinsame Boards', { exact: true })).toBeVisible()
  // In Your Settings' section heading style, no capitals (#280).
  await expect(shown.getByText('Gemeinsame Boards', { exact: true })).toHaveCSS('text-transform', 'none')
  await expect(shown.getByText('Gemeinsame Boards', { exact: true })).toHaveCSS('font-size', '16px')
  await expect(shown.getByRole('listitem')).toHaveText(['🍲 Meine Küche', '🍜 Kochclub'])
  // Her own Board never shows, nor her Google name, nor anything cooked.
  await expect(shown).not.toContainText('Geheimrezepte')
  await expect(shown).not.toContainText('Katherine')
  await expect(shown).not.toContainText('gekocht')
  // A large Profile Picture: her initial, as she has no picture.
  const picture = shown.locator('[data-person-picture]')
  await expect(picture).toHaveText('J')
  expect((await picture.boundingBox())!.width).toBeGreaterThanOrEqual(64)
}

test.beforeAll(async ({ browser }) => {
  await removeUsers(HAMILTON, JOHNSON)
  const johnson = await newTab(browser)
  await signIn(johnson, JOHNSON, { name: 'Katherine Johnson' })
  expect((await johnson.request.put('/api/me/username', { data: { username: 'Johnson' } })).ok()).toBe(true)
  expect((await johnson.request.post('/api/boards', { data: { name: 'Geheimrezepte', emoji: '🤫' } })).ok()).toBe(true)

  const page = await newTab(browser)
  await signIn(page, HAMILTON, { name: 'Margaret Hamilton' })
  expect((await page.request.put('/api/me/username', { data: { username: 'Hamilton' } })).ok()).toBe(true)
  await resetBoard(page)
  const home = await landingBoardId(page)
  expect((await johnson.request.post(`/api/invites/${await inviteToken(page, home)}/join`)).ok()).toBe(true)
  await seedDish(page, { title: 'Linsencurry', sourceLink: TIKTOK, sourceKind: 'tiktok', addedBy: JOHNSON })
  await seedDish(page, { title: 'Ofenkartoffeln', sourceLink: TIKTOK, sourceKind: 'tiktok', addedBy: JOHNSON })
  await seedDish(page, { title: 'Pilzrisotto', sourceLink: TIKTOK, sourceKind: 'tiktok', addedBy: HAMILTON })
  const club = await page.request.post('/api/boards', { data: { name: 'Kochclub', emoji: '🍜' } })
  const { id: clubId } = await club.json() as { id: string }
  expect((await johnson.request.post(`/api/invites/${await inviteToken(page, clubId)}/join`)).ok()).toBe(true)
  await johnson.context().close()
  await page.context().close()
})

async function openBoard(page: Page) {
  await signIn(page, HAMILTON)
  const boards = await (await page.request.get('/api/boards')).json() as { id: string, name: string }[]
  await gotoHydrated(page, `/b/${boards.find(b => b.name === 'Meine Küche')!.id}`)
  await cardAtRest(page.getByRole('link', { name: 'Linsencurry', exact: true }))
}

test('on a computer, hovering a Member’s picture on a card shows their popover until the pointer leaves it and the picture', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await openBoard(page)
  const url = page.url()
  const button = personButton(page, 'Linsencurry')

  // The button sits on the picture the card draws.
  const drawn = (await card(page, 'Linsencurry').locator('[data-added-by]').boundingBox())!
  const hit = (await button.boundingBox())!
  expect(Math.abs((hit.x + hit.width / 2) - (drawn.x + drawn.width / 2))).toBeLessThanOrEqual(1)
  expect(Math.abs((hit.y + hit.height / 2) - (drawn.y + drawn.height / 2))).toBeLessThanOrEqual(1)
  await expect(button).toHaveAccessibleName('Hinzugefügt von Johnson')

  await button.hover()
  await expectJohnson(page)
  await expectOnScreen(page, popover(page))
  // Not the Tooltip: the popover says it all.
  await expect(page.locator('[data-app-tooltip]')).toBeHidden()

  // Over to the popover, it stays; hovering opened no Dish and started no drag.
  await popover(page).hover()
  await page.waitForTimeout(500)
  await expect(popover(page)).toBeVisible()
  expect(page.url()).toBe(url)
  await expect(page.getByTestId('drag-card')).toHaveCount(0)

  // Away from both, it closes.
  await page.mouse.move(DESKTOP.width - 5, DESKTOP.height - 5)
  await expect(popover(page)).toBeHidden()
  expect(page.url()).toBe(url)
})

test('one’s own picture shows one’s own popover, with all one’s Boards', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await openBoard(page)

  await personButton(page, 'Pilzrisotto').hover()

  const shown = popover(page)
  await expect(shown.getByText('Hamilton', { exact: true })).toBeVisible()
  await expect(shown.getByText('1 Gericht hinzugefügt', { exact: true })).toBeVisible()
  await expect(shown.getByText('Deine Boards', { exact: true })).toBeVisible()
  await expect(shown.getByRole('listitem')).toHaveText(['🍲 Meine Küche', '🍜 Kochclub'])
  await expect(shown).not.toContainText('Margaret')
})

test('the keyboard opens it with Enter, and Escape closes it', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await openBoard(page)
  const button = personButton(page, 'Linsencurry')

  await button.focus()
  await page.keyboard.press('Enter')
  await expectJohnson(page)
  await expect(button).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Escape')
  await expect(popover(page)).toBeHidden()
  await expect(button).toHaveAttribute('aria-expanded', 'false')
})

test('on a phone, tapping a picture on a card shows the popover without opening the Dish; a tap outside closes it', async ({ browser }) => {
  const page = await newTab(browser, { hasTouch: true, isMobile: true, viewport: PHONE })
  await openBoard(page)
  const url = page.url()
  const button = personButton(page, 'Linsencurry')

  await button.tap()
  await expectJohnson(page)
  await expectOnScreen(page, popover(page))
  // Neither the Dish nor a drag.
  await page.waitForTimeout(500)
  expect(page.url()).toBe(url)
  await expect(page.getByTestId('drag-card')).toHaveCount(0)
  // A tap in it keeps it open.
  await popover(page).getByText('Johnson', { exact: true }).tap()
  await expect(popover(page)).toBeVisible()

  // The empty lane under the cards.
  await page.touchscreen.tap(40, PHONE.height - 160)
  await expect(popover(page)).toBeHidden()
  expect(page.url()).toBe(url)

  // The picture again opens it, and once more closes it.
  await button.tap()
  await expect(popover(page)).toBeVisible()
  await button.tap()
  await expect(popover(page)).toBeHidden()

  // The rest of the card still opens the Dish.
  await page.getByRole('link', { name: 'Linsencurry', exact: true }).getByRole('heading').tap()
  await expect(page).toHaveURL(/\/b\/[^/]+\/[^/]+$/)
  await page.context().close()
})

test('in the Dish detail, hovering who added it shows their popover over the detail; Escape closes only the popover', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await openBoard(page)
  await page.getByRole('link', { name: 'Linsencurry', exact: true }).click()
  const detail = page.getByRole('dialog', { name: 'Linsencurry' })
  await expect(detail).toBeVisible()
  const added = detail.getByRole('button', { name: 'Johnson hat das Gericht hinzugefügt' })

  await added.hover()
  await expectJohnson(page)
  await expectOnScreen(page, popover(page))
  // Above the detail: the pointer reaches it.
  const box = (await popover(page).boundingBox())!
  expect(await popover(page).evaluate((el, { x, y }) => el.contains(document.elementFromPoint(x, y)), { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true)

  await page.keyboard.press('Escape')
  await expect(popover(page)).toBeHidden()
  await expect(detail).toBeVisible()

  // Leaving it closes it too.
  await page.mouse.move(0, 0)
  await added.hover()
  await expect(popover(page)).toBeVisible()
  await page.mouse.move(DESKTOP.width / 2, 10)
  await expect(popover(page)).toBeHidden()
  await expect(detail).toBeVisible()
})

test('in the Dish detail on a phone, tapping who added it shows the popover; a tap outside closes it and leaves the detail open', async ({ browser }) => {
  const page = await newTab(browser, { hasTouch: true, isMobile: true, viewport: PHONE })
  await openBoard(page)
  await page.getByRole('link', { name: 'Linsencurry', exact: true }).getByRole('heading').tap()
  const detail = page.getByRole('dialog', { name: 'Linsencurry' })
  await expect(detail).toBeVisible()
  const url = page.url()
  const added = detail.getByRole('button', { name: 'Johnson hat das Gericht hinzugefügt' })
  await added.scrollIntoViewIfNeeded()

  await added.tap()
  await expectJohnson(page)
  await expectOnScreen(page, popover(page))

  // Outside it, on the detail's title.
  await detail.getByRole('heading', { name: 'Linsencurry' }).tap()
  await expect(popover(page)).toBeHidden()
  await expect(detail).toBeVisible()
  expect(page.url()).toBe(url)
  await page.context().close()
})

test('someone who left every Board shared with you still shows by name and picture, and nothing more', async ({ browser, page }) => {
  const johnson = await newTab(browser)
  await signIn(johnson, JOHNSON)
  const { id } = await (await johnson.request.get('/api/me')).json() as { id: string }
  const boards = await (await johnson.request.get('/api/boards')).json() as { id: string, name: string }[]
  for (const board of boards.filter(b => b.name !== 'Geheimrezepte')) {
    expect((await johnson.request.delete(`/api/boards/${board.id}/members/${id}`)).ok()).toBe(true)
  }
  await johnson.context().close()
  await page.setViewportSize(DESKTOP)
  await openBoard(page)

  // The Dishes she added stay, with her picture.
  await personButton(page, 'Linsencurry').hover()

  const shown = popover(page)
  await expect(shown.getByText('Mehr ist gerade nicht zu sehen.', { exact: true })).toBeVisible()
  await expect(shown.getByText('Johnson', { exact: true })).toBeVisible()
  await expect(shown).not.toContainText('Geheimrezepte')
  await expect(shown).not.toContainText('hinzugefügt')
})
