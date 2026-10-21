import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { fastPolls } from './polls'
import { landingBoardId, removeUsers, seedDish } from './seed'

// What a Dish's card shows of its Dish History (#335): the chip on its
// image with the Votes and Comments, which turns orange when another
// Member added something since you last opened the Dish, until you open
// it. Yalow's Board is used by this file only; Widnall joins it.
test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 800 } })

const YALOW = ALLOWLISTED[94]
const WIDNALL = ALLOWLISTED[95]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// CI's retry runs the whole file again, on the same database.
test.beforeAll(() => removeUsers(YALOW, WIDNALL))

test('another Member\'s Comment marks the card; opening the Dish clears it', async ({ page, browser }) => {
  await fastPolls(page)
  await signIn(page, YALOW)
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Linsen-Dal', sourceLink: TIKTOK, sourceKind: 'tiktok', addedBy: YALOW })
  await reloadHydrated(page)
  const card = page.getByRole('link', { name: 'Linsen-Dal' })
  const chip = card.locator('[data-history-chip]')
  await expect(chip).toHaveCount(0)

  const boardId = await landingBoardId(page)
  const token = await inviteToken(page, boardId)
  const other = await newTab(browser)
  await signIn(other, WIDNALL)
  const headers = { origin: E2E_ORIGIN }
  expect((await other.request.post(`/api/invites/${token}/join`, { headers })).ok()).toBe(true)
  const board = await (await other.request.get(`/api/boards/${boardId}`)).json() as { columns: { dishes: { id: string, title: string }[] }[] }
  const dish = board.columns.flatMap(c => c.dishes).find(d => d.title === 'Linsen-Dal')!
  expect((await other.request.post(`/api/dishes/${dish.id}/comments`, { headers, data: { text: 'Mit Kokosmilch!' } })).ok()).toBe(true)
  await other.context().close()

  // The Board's polling brings it.
  await expect(chip).toHaveAttribute('data-new', 'true')
  await expect(chip).toContainText('1 Kommentar, Neues im Verlauf')
  await expect(chip.locator('[data-chip-line="bubble"]')).toHaveText('1')

  await card.click()
  const detail = page.getByRole('dialog', { name: 'Linsen-Dal' })
  await expect(detail.locator('[data-comment]')).toHaveCount(1)
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(detail).toBeHidden()

  await expect(chip).not.toHaveAttribute('data-new')
  await expect(chip.locator('[data-chip-line="bubble"]')).toHaveText('1')
  // And it stays cleared, as the server recorded the opening.
  await reloadHydrated(page)
  await expect(chip).toBeVisible()
  await expect(chip).not.toHaveAttribute('data-new')
})

test('a Comment the Member writes counts on the card, without marking it', async ({ page }) => {
  await signIn(page, YALOW)
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Linsen-Dal' }).click()
  const detail = page.getByRole('dialog', { name: 'Linsen-Dal' })
  const history = detail.locator('[data-dish-history]')
  await history.getByRole('textbox', { name: 'Kommentar' }).fill('Dann mache ich es Freitag')
  await history.getByRole('button', { name: 'Senden' }).click()
  await expect(history.locator('[data-comment]')).toHaveCount(2)
  await detail.getByRole('button', { name: 'Schließen' }).first().click()

  const chip = page.getByRole('link', { name: 'Linsen-Dal' }).locator('[data-history-chip]')
  await expect(chip.locator('[data-chip-line="bubble"]')).toHaveText('2')
  await expect(chip).not.toHaveAttribute('data-new')
  await reloadHydrated(page)
  await expect(chip.locator('[data-chip-line="bubble"]')).toHaveText('2')
  await expect(chip).not.toHaveAttribute('data-new')
})
