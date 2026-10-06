import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { cardAtRest } from './board'
import { editMorph, expectFieldsMorphing, slowAnimations } from './edit-morph'
import { gotoHydrated, reloadHydrated } from './hydration'
import { clickAndExpectSaving } from './loading'
import { removeStoredImages, seedCookings, seedDish, storedImage } from './seed'
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

  await expect(page).toHaveURL(/\/b\/meine-kueche(-\d+)?\/crispy-tofu-[^/]+$/)
  await expect(detail.getByRole('heading', { level: 1 })).toHaveText('Crispy Tofu')
  await expect(detail.locator('img[src="/placeholders/bowl-light.svg"]').first()).toBeVisible()
  await expect(detail.getByText('TikTok')).toBeVisible()
  const original = detail.getByRole('link', { name: 'Original öffnen' })
  await expect(original).toHaveAttribute('href', TIKTOK)
  await expect(original).toHaveAttribute('target', '_blank')
  await expect(detail.getByText('Meine Küche · Diese Woche')).toBeVisible()
  await expect(detail.getByText(/^Hinzugefügt am \d/)).toBeVisible()
  // Without a Creator, no empty line for one.
  await expect(detail.locator('[data-creator]')).toHaveCount(0)

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

test('the Creator shows under the title on the card and in the detail, and can be changed and cleared', async ({ page }) => {
  await signIn(page, ALLOWLISTED[0])
  await seedDish(page, { title: 'Gochujang-Tofu', sourceLink: TIKTOK, sourceKind: 'tiktok', creator: 'Scout, Suki & Stella' })
  await gotoHydrated(page, '/')
  const card = page.getByRole('article', { name: 'Gochujang-Tofu' })
  await expect(card.locator('[data-creator]')).toHaveText('Veröffentlicht von Scout, Suki & Stella')

  const detail = await openDetail(page, 'Gochujang-Tofu')
  const creator = detail.locator('[data-creator]')
  await expect(creator).toHaveText('Veröffentlicht von Scout, Suki & Stella')
  await expect(creator).toBeVisible()

  // Edit mode's field morphs from where the Creator was, rather than
  // rising in from nowhere (12px below). Slowed once the card has finished
  // morphing into the detail.
  await expect(page.locator('html')).not.toHaveAttribute('data-morph')
  const normalSpeed = await slowAnimations(page)
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  const from = await detail.locator('[data-morph-field="creator"]').evaluate(el => el.getAnimations()
    .filter(animation => animation.id === 'edit-morph')
    .map(animation => (animation.effect as KeyframeEffect).getKeyframes()[0]?.translate))
  await normalSpeed()
  expect(from).toHaveLength(1)
  expect(from[0]).not.toMatch(/^0(px)? 12px$/)
  const field = detail.getByLabel('Veröffentlicht von')
  await expect(field).toHaveValue('Scout, Suki & Stella')
  await field.fill('  @veganschnitzel ')
  await detail.getByRole('button', { name: 'Speichern' }).click()
  await expect(creator).toHaveText('Veröffentlicht von @veganschnitzel')
  await reloadHydrated(page)
  await expect(creator).toHaveText('Veröffentlicht von @veganschnitzel')

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByLabel('Veröffentlicht von').fill('')
  await detail.getByRole('button', { name: 'Speichern' }).click()
  await expect(detail.getByRole('button', { name: 'Bearbeiten' }).first()).toBeVisible()
  await expect(creator).toHaveCount(0)
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(card.locator('[data-creator]')).toHaveCount(0)
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
  await seedDish(page, { title: 'Ofengemüse', imageUrl: image, sourceLink: blog, sourceKind: 'blog', creator: 'Kochblog' })
  // A new link is looked up at once; what it finds for the image is only
  // used by "Bild neu laden", and its Creator never.
  await stubSourceLookup(page, { kind: 'instagram-reel', canonicalLink: reel, suggestedTitle: '', creator: 'Jemand anderes', imageUrl: found, imageTicket: 'fixture-ticket' })
  await stubImage(page, found, 90, 160)
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
  // Dish keeps the image it had, with a notice saying why.
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByRole('button', { name: 'Bild neu laden' }).click()
  await expect(detail.locator('[data-reloaded-image]')).toHaveAttribute('src', found)
  body = editedBody(page)
  await detail.getByRole('button', { name: 'Speichern' }).click()
  expect(await body).toMatchObject({ imageUrl: found, imageTicket: 'fixture-ticket', source: { link: reel, kind: 'instagram-reel' }, creator: 'Kochblog' })
  await expect(page.locator('[data-toast]')).toContainText('„Ofengemüse“ behält sein bisheriges Bild')
  await expect(detail.locator('[data-creator]')).toHaveText('Veröffentlicht von Kochblog')
  await expect(detail.locator('[data-dish-image]')).toHaveAttribute('src', image)

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

test('an image found for one link is dropped when the link changes again', async ({ page }) => {
  const reel = 'https://www.instagram.com/reel/OfenGemuese1/'
  const found = 'https://images.invalid/wechsel.png'
  await signIn(page, ALLOWLISTED[0])
  const image = await storedImage(160, 90)
  await seedDish(page, { title: 'Linkwechsel', imageUrl: image, sourceLink: reel, sourceKind: 'instagram-reel' })
  await stubSourceLookup(page, { kind: 'instagram-reel', canonicalLink: reel, suggestedTitle: '', imageUrl: found, imageTicket: 'fixture-ticket' })
  await stubImage(page, found, 90, 160)
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Linkwechsel')

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByRole('button', { name: 'Bild neu laden' }).click()
  await expect(detail.locator('[data-reloaded-image]')).toHaveAttribute('src', found)
  await detail.getByLabel('Link').fill('https://www.youtube.com/shorts/anderesVideo1')

  await expect(detail.locator('[data-reloaded-image]')).toHaveCount(0)
  await expect(detail.locator('[data-dish-image]')).toHaveAttribute('src', image)
  await expect(detail.getByText('Neues Bild vom Link.')).toHaveCount(0)
  const body = editedBody(page)
  await detail.getByRole('button', { name: 'Speichern' }).click()
  expect(await body).not.toHaveProperty('imageUrl')
})

test('a Placeholder chosen with the arrow keys is the one shown and saved', async ({ page }) => {
  await signIn(page, ALLOWLISTED[0])
  const image = await storedImage(160, 90)
  await seedDish(page, { title: 'Pfeiltasten', imageUrl: image, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Pfeiltasten')

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  const picker = page.getByRole('dialog', { name: 'Bild wählen' })
  await picker.getByRole('radio', { name: 'Bowl' }).focus()
  await page.keyboard.press('ArrowRight')
  await picker.getByRole('button', { name: 'Schließen' }).click()

  await expect(detail.locator('img[src="/placeholders/salad-light.svg"]').first()).toBeVisible()
  await expect(detail.locator('[data-dish-image]')).toHaveCount(0)
  const body = editedBody(page)
  await detail.getByRole('button', { name: 'Speichern' }).click()
  expect(await body).toMatchObject({ placeholder: 'salad', imageUrl: null })
})

test('focus follows the detail: into edit mode, back out, and back to the card', async ({ page }) => {
  await signIn(page, ALLOWLISTED[0])
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Pfeiltasten')

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await expect(detail.getByLabel('Titel')).toBeFocused()
  await detail.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toBeFocused()
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByRole('button', { name: 'Speichern' }).click()
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toBeFocused()

  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()
  await expect(page.getByRole('link', { name: 'Pfeiltasten' })).toBeFocused()
})

test('the read-only Dish morphs into its fields one after another, and back', async ({ page }) => {
  await signIn(page, ALLOWLISTED[0])
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Pfeiltasten')

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await expectFieldsMorphing(detail)
  await expect(detail.getByLabel('Titel')).toBeFocused()

  // Leaving reverses it: the fields morph back into the read-only Dish.
  await page.keyboard.press('Escape')
  await expectFieldsMorphing(detail)
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toBeFocused()
})

test('leaving edit mode scrolled down, the title starts where its field was', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await signIn(page, ALLOWLISTED[0])
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Pfeiltasten')
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  // Once edit mode has settled. The picker's Placeholder loop never finishes.
  await detail.evaluate(el => Promise.all(el.getAnimations({ subtree: true })
    .filter(a => a.effect?.getTiming().iterations !== Infinity)
    .map(a => a.finished)))
  await detail.evaluate(el => el.scrollTo(0, el.scrollHeight))
  expect(await detail.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  const title = detail.locator('[data-morph-field="title"]')
  const field = (await title.boundingBox())!

  // Slowed, the title is still waiting at its start when the test looks,
  // though "Bearbeiten" taking focus has scrolled the detail back up.
  const normalSpeed = await slowAnimations(page)
  await page.keyboard.press('Escape')
  await editMorph(detail)
  const start = (await title.boundingBox())!
  await normalSpeed()

  expect(Math.abs(start.y - field.y)).toBeLessThan(1)
  expect(Math.abs(start.x - field.x)).toBeLessThan(1)
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toBeFocused()
})

test('beside the Board, tapping the dimmed Board or Escape closes the detail but never discards edits', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await signIn(page, ALLOWLISTED[0])
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Pfeiltasten')

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByLabel('Titel').fill('Halb bearbeitet')
  await page.mouse.click(100, 450)
  await expect(detail.getByLabel('Titel')).toHaveValue('Halb bearbeitet')

  // Escape in the picker closes only the picker; in edit mode, only edit mode.
  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Bild wählen' })).toBeHidden()
  await expect(detail.getByLabel('Titel')).toHaveValue('Halb bearbeitet')
  await page.keyboard.press('Escape')
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toBeFocused()

  await page.mouse.click(100, 450)
  await expect(detail).toBeHidden()
})

test('a new link is saved as what it really is, looked up like in Add Dish', async ({ page }) => {
  const blog = 'https://www.kochblog.example/rezept/linsen-dal'
  let release!: () => void
  const hold = new Promise<void>(resolve => release = resolve)
  await signIn(page, ALLOWLISTED[0])
  await seedDish(page, { title: 'Linsen-Dal', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await stubSourceLookup(page, { kind: 'blog', canonicalLink: blog, suggestedTitle: 'Linsen-Dal', imageUrl: 'https://images.invalid/dal.png', imageTicket: 'fixture-ticket' }, hold)
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Linsen-Dal')

  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByLabel('Link').fill(`${blog}?utm_source=pinterest`)
  const body = editedBody(page)
  // Saving waits for the lookup's answer, with the three dots.
  await clickAndExpectSaving(detail.locator('button[type="submit"]'), 'Speichert …')
  release()

  const sent = await body
  expect(sent).toMatchObject({ source: { link: blog, kind: 'blog' } })
  // The lookup never changes the image; only "Bild neu laden" does.
  expect(sent).not.toHaveProperty('imageUrl')
  await expect(detail.getByText('Web')).toBeVisible()
  await expect(detail.getByRole('link', { name: 'Original öffnen' })).toHaveAttribute('href', blog)
})

test('without View Transitions, the card’s image still morphs into the detail and back', async ({ page }) => {
  await page.addInitScript(() => {
    delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[0])
  await gotoHydrated(page, '/')
  const card = page.getByRole('link', { name: 'Pfeiltasten' })
  await cardAtRest(card)
  const thumb = (await card.locator('[data-thumb]').boundingBox())!

  await card.click()

  // Frozen at its start, the detail's image sits where the card's was.
  const detail = page.getByRole('dialog', { name: 'Pfeiltasten' })
  const image = detail.locator('[data-detail-image]')
  await expect.poll(() => image.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0)
  await image.evaluate((el) => {
    for (const animation of el.getAnimations()) {
      animation.pause()
      animation.currentTime = 0
    }
  })
  const start = (await image.boundingBox())!
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(start[key]).toBeCloseTo(thumb[key], 0)
  await image.evaluate(el => el.getAnimations().forEach(a => a.play()))

  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()
  await expect(card).toBeFocused()
})

// Scrolling the detail (handoff motion.json "Detail parallax + bar"): its
// image moves slower than the content, and once it has scrolled away a
// compact bar settles in at the top. A Dish with a long Cooking History, so
// the detail scrolls well past its image.
const LONG = 'Lange Geschichte'

// Scrolls the detail to `top`, and waits for what follows the scroll.
async function scrollDetailTo(detail: Locator, top: number) {
  await detail.evaluate(async (el, y) => {
    el.scrollTo(0, y)
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }, top)
}

// Opens the long Dish's detail once it has finished moving in, scrolled to
// the top.
async function openLongDetail(page: Page) {
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, LONG)
  await settledBox(detail)
  return detail
}

// How far the image moves up on screen as the detail scrolls down half its
// height (`by`, which the content moves), how it looks at the top and then,
// and whether a scroll-driven animation moves it.
async function parallax(detail: Locator) {
  const frame = detail.locator('[data-detail-image]')
  const image = detail.locator('[data-parallax]')
  const centre = async () => {
    const box = (await image.boundingBox())!
    return box.y + box.height / 2
  }
  await scrollDetailTo(detail, 0)
  const from = await centre()
  const opacityAtTop = await image.evaluate(el => Number(getComputedStyle(el).opacity))
  const by = (await frame.boundingBox())!.height / 2
  await scrollDetailTo(detail, by)
  const moved = from - await centre()
  const look = await image.evaluate((el) => {
    const style = getComputedStyle(el)
    return { opacity: Number(style.opacity), scale: style.scale, scrollDriven: el.getAnimations().length > 0 }
  })
  return { by, moved, opacityAtTop, ...look }
}

// How far the detail scrolls until its image has gone.
async function imageHeight(detail: Locator) {
  return (await detail.locator('[data-detail-image]').boundingBox())!.height
}

test('once the image has scrolled away, a compact bar settles in with close, the title and "Bearbeiten"', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await signIn(page, ALLOWLISTED[0])
  await seedDish(page, { title: LONG, sourceLink: TIKTOK, sourceKind: 'tiktok', note: 'Jeden Sonntag.\nMit viel Knoblauch.' })
  await seedCookings(page, LONG, 12)
  await page.addInitScript(() => {
    const w = window as unknown as { morphs: number }
    w.morphs = 0
    const start = Document.prototype.startViewTransition
    Document.prototype.startViewTransition = function (...args: Parameters<typeof start>) {
      w.morphs++
      return start.apply(this, args)
    }
  })
  const detail = await openLongDetail(page)
  const bar = detail.locator('[data-detail-bar]')
  const below = await imageHeight(detail)

  // At the top, and with a strip of the image still showing, there is no
  // bar, and only the header's buttons.
  await expect(bar).toBeHidden()
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(1)
  await scrollDetailTo(detail, below - 100)
  await expect(bar).toBeHidden()

  // The image gone, the bar sits at the top with the title.
  await scrollDetailTo(detail, below)
  await expect(bar).toBeVisible()
  await expect(bar).toContainText(LONG)
  await expect.poll(async () => Math.round((await bar.boundingBox())!.y)).toBe(0)

  // Back up, it goes.
  await scrollDetailTo(detail, 0)
  await expect(bar).toBeHidden()

  // "Bearbeiten" from the bar opens edit mode; leaving it, focus goes back
  // to the header's "Bearbeiten", up top.
  await scrollDetailTo(detail, below)
  await bar.getByRole('button', { name: 'Bearbeiten' }).click()
  await expect(detail.getByLabel('Titel')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(detail.locator('[data-edit]')).toBeFocused()

  // Its close button closes the detail, without morphing the image, out of
  // view, into the card.
  await scrollDetailTo(detail, below)
  const morphs = () => page.evaluate(() => (window as unknown as { morphs: number }).morphs)
  const morphsBefore = await morphs()
  await bar.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()
  await expect(page.getByRole('link', { name: LONG })).toBeFocused()
  expect(await morphs()).toBe(morphsBefore)
})

for (const [width, height] of [[390, 600], [1024, 700]] as const) {
  test(`at ${width}px, the image moves slower than the content as the detail scrolls, fading and growing slightly`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await signIn(page, ALLOWLISTED[0])
    const detail = await openLongDetail(page)

    const { by, moved, opacity, scale, scrollDriven } = await parallax(detail)

    expect(scrollDriven).toBe(true)
    expect(moved).toBeGreaterThan(by * 0.25)
    expect(moved).toBeLessThan(by * 0.75)
    expect(opacity).toBeLessThan(1)
    expect(Number(scale)).toBeGreaterThan(1)
  })
}

test('without scroll-driven animations, the image still parallaxes', async ({ page }) => {
  await page.addInitScript(() => {
    const supports = CSS.supports.bind(CSS) as (...args: string[]) => boolean
    CSS.supports = (...args: string[]) => !args.join(':').includes('animation-timeline') && supports(...args)
  })
  await page.setViewportSize({ width: 390, height: 600 })
  await signIn(page, ALLOWLISTED[0])
  const detail = await openLongDetail(page)

  const { by, moved, opacityAtTop, opacity, scrollDriven } = await parallax(detail)

  expect(scrollDriven).toBe(false)
  expect(opacityAtTop).toBe(1)
  expect(moved).toBeGreaterThan(by * 0.25)
  expect(moved).toBeLessThan(by * 0.75)
  expect(opacity).toBeLessThan(1)
})

test('with reduced motion, the image scrolls with the content, and the bar still appears', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 600 })
  await signIn(page, ALLOWLISTED[0])
  const detail = await openLongDetail(page)

  const { by, moved, opacity } = await parallax(detail)

  expect(moved).toBeCloseTo(by, 0)
  expect(opacity).toBe(1)
  await scrollDetailTo(detail, await imageHeight(detail))
  await expect(detail.locator('[data-detail-bar]')).toBeVisible()
})
