import { expect, test, type Locator, type Page } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeStoredImages, seedDish, storedImage } from './seed'
import { stubImage, stubSourceLookup } from './source-lookup-stub'

// The Dish detail (PRD stories 41–45): tapping a card opens it, full-screen
// on phones and as a side panel beside the Board from 768px. Ada's Board is
// used by this file only.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

async function openDetail(page: Page, title: string) {
  await page.getByRole('link', { name: title }).click()
  const detail = page.getByRole('dialog', { name: title })
  await expect(detail).toBeVisible()
  return detail
}

// Where the detail sits once it has finished moving in, in whole pixels.
async function settledBox(detail: Locator) {
  await detail.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  const box = await detail.boundingBox()
  return box && Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v)]))
}

test('tapping a card opens its detail with everything about the Dish', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[0])
  await seedDish(page, { title: 'Crispy Tofu', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: /^Diese Woche/ }).click()

  const detail = await openDetail(page, 'Crispy Tofu')

  await expect(page).toHaveURL(/\/b\/[^/]+\/d\/[^/]+$/)
  await expect(detail.getByRole('heading', { level: 1 })).toHaveText('Crispy Tofu')
  await expect(detail.locator('img[src="/placeholders/bowl-light.svg"]').first()).toBeVisible()
  await expect(detail.getByText('TikTok')).toBeVisible()
  const original = detail.getByRole('link', { name: 'Original öffnen' })
  await expect(original).toHaveAttribute('href', TIKTOK)
  await expect(original).toHaveAttribute('target', '_blank')
  await expect(detail.getByText('Meine Küche · Diese Woche')).toBeVisible()
  await expect(detail.getByText(/^Hinzugefügt am \d/)).toBeVisible()

  // Phones: full-screen.
  expect(await settledBox(detail)).toEqual({ x: 0, y: 0, width: 390, height: 844 })

  // Closing goes back to the Board, still on the Dish's Column.
  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()
  await expect(page).toHaveURL(/\/b\/[^/]+$/)
  await expect(page.getByRole('button', { name: /^Diese Woche/ })).toHaveAttribute('aria-pressed', 'true')
})

for (const [width, panel] of [[1024, 440], [1440, 480]] as const) {
  test(`at ${width}px the detail is a ${panel}px side panel beside the Board`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page, ALLOWLISTED[0])
    await gotoHydrated(page, '/')

    const detail = await openDetail(page, 'Crispy Tofu')

    expect(await settledBox(detail)).toEqual({ x: width - panel, y: 0, width: panel, height: 900 })
    await page.keyboard.press('Escape')
    await expect(detail).toBeHidden()
    await expect(page).toHaveURL(/\/b\/[^/]+$/)
  })
}

test('a deep link opens the detail over its Board', async ({ page }) => {
  await signIn(page, ALLOWLISTED[0])
  await gotoHydrated(page, '/')
  await (await openDetail(page, 'Crispy Tofu')).isVisible()
  const url = page.url()

  await gotoHydrated(page, url)

  await expect(page.getByRole('dialog', { name: 'Crispy Tofu' })).toBeVisible()
  await expect(page.locator('h1', { hasText: 'Meine Küche' })).toBeAttached()
})

test('edits to the title, note and image persist; Abbrechen discards them', async ({ page }) => {
  await signIn(page, ALLOWLISTED[0])
  await gotoHydrated(page, '/')
  let detail = await openDetail(page, 'Crispy Tofu')

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByLabel('Titel').fill('Wird verworfen')
  await detail.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(detail.getByRole('heading', { level: 1 })).toHaveText('Crispy Tofu')

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByLabel('Titel').fill('Knuspriger Tofu')
  await detail.getByLabel('Notiz').fill('Mit Maisstärke wird er knuspriger')
  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  await page.getByRole('dialog', { name: 'Bild wählen' }).getByRole('radio', { name: 'Wok' }).click()
  await expect(detail.locator('img[src="/placeholders/wok-light.svg"]').first()).toBeVisible()
  await detail.getByRole('button', { name: 'Speichern' }).click()

  detail = page.getByRole('dialog', { name: 'Knuspriger Tofu' })
  await expect(detail.getByRole('heading', { level: 1 })).toHaveText('Knuspriger Tofu')
  await expect(detail.getByText('Mit Maisstärke wird er knuspriger')).toBeVisible()
  await expect(detail.locator('img[src="/placeholders/wok-light.svg"]').first()).toBeVisible()

  await reloadHydrated(page)
  await expect(detail.getByText('Mit Maisstärke wird er knuspriger')).toBeVisible()
  await expect(detail.locator('img[src="/placeholders/wok-light.svg"]').first()).toBeVisible()
  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(page.getByRole('article', { name: 'Knuspriger Tofu' }).locator('img[src="/placeholders/wok-light.svg"]')).toBeVisible()
})

test.afterAll(removeStoredImages)

function editedBody(page: Page) {
  return page.waitForRequest(r => r.method() === 'PATCH' && /\/api\/dishes\/[^/]+$/.test(r.url()))
    .then(r => r.postDataJSON() as Record<string, unknown>)
}

test('changing the Source keeps the image; "Bild neu laden" replaces it, or falls back to the Placeholder', async ({ page }) => {
  const blog = 'https://kochblog.example/rezept/ofengemuese'
  const reel = 'https://www.instagram.com/reel/OfenGemuese1/'
  const found = 'https://images.invalid/ofengemuese.png'
  await signIn(page, ALLOWLISTED[0])
  const image = await storedImage(160, 90)
  await seedDish(page, { title: 'Ofengemüse', imageUrl: image, sourceLink: blog, sourceKind: 'blog' })
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Ofengemüse')
  await expect(detail.locator('[data-dish-image]')).toHaveAttribute('src', image)

  // A new Source, no new image.
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByLabel('Link').fill(`${reel}?igsh=abc`)
  let body = editedBody(page)
  await detail.getByRole('button', { name: 'Speichern' }).click()
  expect(await body).not.toHaveProperty('imageUrl')
  await expect(detail.getByText('Instagram')).toBeVisible()
  await expect(detail.getByRole('link', { name: 'Original öffnen' })).toHaveAttribute('href', reel)
  await expect(detail.locator('[data-dish-image]')).toHaveAttribute('src', image)
  await reloadHydrated(page)
  await expect(detail.locator('[data-dish-image]')).toHaveAttribute('src', image)

  // "Bild neu laden" looks the new Source up and shows what it found; saving
  // stores it. The fixture host never resolves, so the copy fails and the
  // Dish falls back to its Placeholder, with a notice saying why.
  await stubSourceLookup(page, { kind: 'instagram-reel', canonicalLink: reel, suggestedTitle: '', imageUrl: found, imageTicket: 'fixture-ticket' })
  await stubImage(page, found, 90, 160)
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByRole('button', { name: 'Bild neu laden' }).click()
  await expect(detail.locator('[data-reloaded-image]')).toHaveAttribute('src', found)
  body = editedBody(page)
  await detail.getByRole('button', { name: 'Speichern' }).click()
  expect(await body).toMatchObject({ imageUrl: found, imageTicket: 'fixture-ticket', source: { link: reel, kind: 'instagram-reel' } })
  await expect(page.locator('[data-notice]')).toContainText('„Ofengemüse“ hat jetzt ein Platzhalterbild')
  await expect(detail.locator('img[src="/placeholders/bowl-light.svg"]').first()).toBeVisible()
  await expect(detail.locator('[data-dish-image]')).toHaveCount(0)

  // Nothing found: the Placeholder it is.
  await page.unrouteAll()
  await stubSourceLookup(page, { kind: 'instagram-reel', canonicalLink: reel, suggestedTitle: '', imageUrl: null, imageTicket: null })
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByRole('button', { name: 'Bild neu laden' }).click()
  await expect(detail.getByText('Kein Bild gefunden.')).toBeVisible()
  body = editedBody(page)
  await detail.getByRole('button', { name: 'Speichern' }).click()
  expect(await body).toMatchObject({ imageUrl: null })
})
