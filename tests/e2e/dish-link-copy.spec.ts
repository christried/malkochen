import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { removeStoredImages, removeUsers, resetBoard, seedDish, storedImage } from './seed'

// Copy from a Dish Link (#403; CONTEXT.md: Dish Link, Copy): "Auf mein Board
// kopieren" on the Dish Link page. Signed out, it goes through sign-in, and
// the landing opens the Dish again with the Board picker; signed in, the
// picker opens at once. [164] shares the Dish, [165] is a new user who signs
// up through the link, [166] has two Boards, [167] has none. Their Boards are
// made here, and removed before the file runs. This file only.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })
test.afterAll(removeStoredImages)
test.beforeAll(() => removeUsers(ALLOWLISTED[165], ALLOWLISTED[166], ALLOWLISTED[167]))

const TIKTOK = 'https://www.tiktok.com/@kochmeister/video/6718335390845095174'

// The Dish on 164's landing Board, shared as a Member does: its path.
async function sharedDish(page: Page): Promise<string> {
  await signIn(page, ALLOWLISTED[164])
  await resetBoard(page)
  const imageUrl = await storedImage(800, 1000)
  await seedDish(page, { title: 'Käsespätzle', imageUrl, sourceLink: TIKTOK, sourceKind: 'tiktok', creator: 'Oma Gerda' })
  const landing = await (await page.request.get('/api/boards/landing')).json() as { boardId: string }
  const board = await (await page.request.get(`/api/boards/${landing.boardId}`)).json() as { columns: { dishes: { id: string, title: string }[] }[] }
  const dish = board.columns.flatMap(c => c.dishes).find(d => d.title === 'Käsespätzle')!
  const shared = await page.request.post(`/api/dishes/${dish.id}/link`)
  expect(shared.status()).toBe(200)
  return (await shared.json() as { path: string }).path
}

async function createBoard(page: Page, name: string): Promise<void> {
  expect((await page.request.post('/api/boards', { data: { name, emoji: '🥘' } })).status()).toBe(201)
}

test('signed out: the link goes through sign-in, and a new user copies the Dish to the Board they start', async ({ browser }) => {
  const owner = await newTab(browser)
  const path = await sharedDish(owner)

  const visitor = await newTab(browser)
  await gotoHydrated(visitor, path)
  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('Käsespätzle')
  await visitor.getByRole('button', { name: 'Auf mein Board kopieren' }).click()
  await expect(visitor).toHaveURL('/login')

  // The same browser signs up; the landing answers the link and opens it with the picker.
  await signIn(visitor, ALLOWLISTED[165])
  await gotoHydrated(visitor, '/')
  const sheet = visitor.getByRole('dialog', { name: 'Kopieren nach…' })
  await expect(sheet).toBeVisible()
  const target = sheet.locator('[data-copy-target]')
  await expect(target).toHaveCount(1)
  await expect(target).toContainText('Meine Küche')
  await target.click()

  // The Copy opens on "Meine Küche", with the same title.
  const { slug } = await (await visitor.request.get('/api/boards/landing')).json() as { slug: string }
  await expect(visitor).toHaveURL(new RegExp(`/b/${slug}/kaesespaetzle-[a-z0-9]+$`))
  await expect(visitor.getByRole('dialog', { name: 'Käsespätzle' })).toBeVisible()
  await expect(visitor.getByRole('dialog', { name: 'Käsespätzle' }).getByText('von Oma Gerda')).toBeVisible()
})

test('signed in with two Boards: the picker lists both, and the Copy opens on the one picked', async ({ browser }) => {
  const owner = await newTab(browser)
  const path = await sharedDish(owner)

  const user = await newTab(browser)
  await signIn(user, ALLOWLISTED[166])
  await resetBoard(user)
  await createBoard(user, 'Zweites')
  await gotoHydrated(user, path)
  await user.getByRole('button', { name: 'Auf mein Board kopieren' }).click()

  const sheet = user.getByRole('dialog', { name: 'Kopieren nach…' })
  await expect(sheet).toBeVisible()
  await expect(sheet.locator('[data-copy-target]')).toHaveCount(2)
  await sheet.locator('[data-copy-target]').filter({ hasText: 'Zweites' }).click()

  await expect(user).toHaveURL(/\/b\/[^/]+\/kaesespaetzle-[a-z0-9]+$/)
  await expect(user.getByRole('dialog', { name: 'Käsespätzle' })).toBeVisible()
})

test('a phone at 360 wide: the button and the picker fit, and a user with no Board starts one', async ({ browser }) => {
  const owner = await newTab(browser)
  const path = await sharedDish(owner)

  const user = await newTab(browser, { viewport: { width: 360, height: 800 } })
  await signIn(user, ALLOWLISTED[167])
  await gotoHydrated(user, path)

  const button = user.getByRole('button', { name: 'Auf mein Board kopieren' })
  const box = await button.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(360)

  await button.click()
  const sheet = user.getByRole('dialog', { name: 'Kopieren nach…' })
  await expect(sheet).toBeVisible()
  const start = sheet.getByRole('button', { name: 'Neues Board anlegen und kopieren' })
  await expect(start).toBeVisible()
  const startBox = await start.boundingBox()
  expect(startBox!.x).toBeGreaterThanOrEqual(0)
  expect(startBox!.x + startBox!.width).toBeLessThanOrEqual(360)
  expect(await user.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await start.click()
  await expect(user).toHaveURL(/\/b\/[^/]+\/kaesespaetzle-[a-z0-9]+$/)
  await expect(user.getByRole('dialog', { name: 'Käsespätzle' })).toBeVisible()
})
