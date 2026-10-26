import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { removeStoredImages, resetBoard, seedDish, storedImage } from './seed'

// Dish Links (#401; CONTEXT.md: Dish Link): a Member shares a Dish from its
// detail, and the link opens signed out with its image, title, Creator and
// Source, and nothing of its Board. [156] and its Board are used by this file only.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })
test.afterAll(removeStoredImages)

const TIKTOK = 'https://www.tiktok.com/@kochmeister/video/6718335390845095173'

async function shareFirstDish(page: Parameters<typeof signIn>[0]) {
  await signIn(page, ALLOWLISTED[156])
  await resetBoard(page)
  const imageUrl = await storedImage(800, 1000)
  await seedDish(page, { title: 'Käsespätzle', imageUrl, sourceLink: TIKTOK, sourceKind: 'tiktok', creator: 'Oma Gerda' })
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Käsespätzle' }).click()
  const detail = page.getByRole('dialog', { name: 'Käsespätzle' })
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: 'Link teilen' }).click()
  await expect(page.getByRole('status')).toHaveText('Link kopiert')
  return { link: await page.evaluate(() => navigator.clipboard.readText()), imageUrl }
}

test('a Member shares a Dish, and the link opens signed out with its image, title, Creator and Source', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 1280, height: 900 })
  const { link, imageUrl } = await shareFirstDish(page)
  expect(link).toMatch(/\/d\/kaesespaetzle-[23456789abcdefghjkmnpqrstuvwxyz]{17}$/)

  const visitor = await newTab(browser)
  await gotoHydrated(visitor, link)

  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('Käsespätzle')
  await expect(visitor.locator('[data-dish-image]')).toHaveAttribute('src', imageUrl)
  await expect(visitor.getByText('von Oma Gerda')).toBeVisible()
  await expect(visitor.locator('[data-source-name]')).toHaveText('TikTok')
  await expect(visitor.getByRole('link', { name: 'Zur Quelle' })).toHaveAttribute('href', TIKTOK)
  // Nothing of the Board.
  await expect(visitor.getByText('Meine Küche')).toHaveCount(0)
  await expect(visitor.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Käsespätzle')
  await expect(visitor.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https?:\/\/.+/)
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('a link no Dish has shows a friendly "not found"', async ({ browser }) => {
  const visitor = await newTab(browser)
  await gotoHydrated(visitor, '/d/pasta-23456789abcdefghj')

  await expect(visitor.getByRole('heading', { level: 1 })).toHaveText('Dieses Gericht gibt es hier nicht mehr')
  await expect(visitor.getByRole('link', { name: 'Zu malkochen' })).toHaveAttribute('href', '/')
  await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('on a phone the card keeps its distance from the edges', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 390, height: 844 })
  const { link } = await shareFirstDish(page)

  const visitor = await newTab(browser, { viewport: { width: 360, height: 800 } })
  await gotoHydrated(visitor, link)

  const box = await visitor.locator('article').boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(16)
  expect(360 - box!.x - box!.width).toBeGreaterThanOrEqual(16)
})
