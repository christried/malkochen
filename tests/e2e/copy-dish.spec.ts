import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { removeStoredImages, removeUsers, resetBoard, seedDish, storedImage } from './seed'

// Copies (#402; CONTEXT.md: Copy): "Kopieren" on a Dish's detail makes a Copy
// on another of the user's Boards, picked in a sheet; the toast says so, and
// "Öffnen" opens the Copy there. [160] is used by this file only; each test
// makes its own second Board, from none (the user is removed before each).
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })
test.afterAll(removeStoredImages)
test.beforeEach(() => removeUsers(ALLOWLISTED[160]))

const TIKTOK = 'https://www.tiktok.com/@kochmeister/video/6718335390845095173'

// A Board made through the API, as another visit would have.
async function createBoard(page: Page, name: string, emoji: string): Promise<void> {
  expect((await page.request.post('/api/boards', { data: { name, emoji } })).status()).toBe(201)
}

// Signs in with a Dish on the landing Board, and a second Board of the user's.
async function setUp(page: Page): Promise<void> {
  await signIn(page, ALLOWLISTED[160])
  await resetBoard(page)
  await createBoard(page, 'Zweites', '🥘')
  const imageUrl = await storedImage(800, 1000)
  await seedDish(page, { title: 'Käsespätzle', imageUrl, sourceLink: TIKTOK, sourceKind: 'tiktok', creator: 'Oma Gerda' })
  await gotoHydrated(page, '/')
}

async function openDetail(page: Page) {
  await page.getByRole('link', { name: 'Käsespätzle' }).click()
  const detail = page.getByRole('dialog', { name: 'Käsespätzle' })
  await expect(detail).toBeVisible()
  return detail
}

test('a Member copies a Dish to another Board, and "Öffnen" opens the Copy there', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await setUp(page)
  const detail = await openDetail(page)

  await detail.getByRole('button', { name: 'Kopieren', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Kopieren nach…' })
  await expect(sheet).toBeVisible()
  // The sheet lists the other Boards: the one the Dish is on is not offered.
  const target = sheet.locator('[data-copy-target]').first()
  const boardName = (await target.textContent())!.trim()
  await target.click()

  await expect(page.getByRole('status')).toContainText(`Auf ${boardName} kopiert`)
  await page.getByRole('button', { name: 'Öffnen' }).click()

  // The Copy opens on the other Board, with the same title.
  await expect(page).toHaveURL(/\/b\/[^/]+\/kaesespaetzle-[a-z0-9]+$/)
  await expect(page.getByRole('dialog', { name: 'Käsespätzle' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Käsespätzle' }).getByText('von Oma Gerda')).toBeVisible()
})

test('on a phone the detail keeps both share buttons inside the screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await setUp(page)
  const detail = await openDetail(page)

  for (const name of ['Link teilen', 'Kopieren']) {
    const box = await detail.getByRole('button', { name, exact: true }).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(360)
  }
})
