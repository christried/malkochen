import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { PLACEHOLDERS } from '../../shared/placeholders'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import * as clips from './clips'
import { gotoHydrated } from './hydration'
import { removeStoredImages, resetBoard, seedDish, storedImage } from './seed'

// Placeholder Image loops (PRD stories 83–85; handoff illustrations.json
// "rules"): a Placeholder loops only in focus (the Dish detail, the picker's
// selection, a lifted or hovered card) and once on first view and when
// scrolling stops; never more than one loop on the Board, none off-screen,
// none with reduced motion. Ruth's Board is used by this file only.
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// The Placeholder loops only: empty Columns and the Cooking History have
// clips of their own (state-clips.spec.ts).
const playing = (scope: Page | Locator) => clips.playing(scope, '/placeholders/')
const countPeakPlaying = (page: Page) => clips.countPeakPlaying(page, '/placeholders/')

// A Board of Placeholder Dishes, each with its own Placeholder, in Ideen:
// the first `count` Placeholders, the last one seeded on top.
async function seedPlaceholderDishes(page: Page, count = 12) {
  await resetBoard(page)
  for (const placeholder of PLACEHOLDERS.slice(0, count)) {
    await seedDish(page, { title: `Gericht ${placeholder}`, placeholder, sourceLink: `${TIKTOK}?${placeholder}`, sourceKind: 'tiktok' })
  }
}

async function openDetail(page: Page, title: string) {
  await page.getByRole('link', { name: title }).click()
  const detail = page.getByRole('dialog', { name: title })
  await expect(detail).toBeVisible()
  return detail
}

test.beforeEach(async ({ page }) => {
  await signIn(page, ALLOWLISTED[17])
})

test.afterAll(removeStoredImages)

test('the Dish detail loops its Placeholder in the current theme', async ({ page }) => {
  await resetBoard(page)
  await seedDish(page, { title: 'Spaghetti', placeholder: 'pasta', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await gotoHydrated(page, '/')

  const detail = await openDetail(page, 'Spaghetti')

  await expect.poll(() => playing(detail)).toEqual(['/placeholders/pasta-dark.svg'])
})

test('a Board full of Placeholders plays one loop on first view and one where scrolling stops', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  const peak = await countPeakPlaying(page)
  await seedPlaceholderDishes(page)
  await gotoHydrated(page, '/')

  // First view: one card loops once, then the Board is still.
  await expect.poll(() => playing(page)).toHaveLength(1)
  await expect.poll(() => playing(page), { timeout: 10_000 }).toEqual([])

  // Scrolling stops with a card in the middle of the screen: it plays once.
  await page.getByRole('link', { name: 'Gericht dumplings' }).evaluate(el => el.scrollIntoView({ block: 'center' }))
  await expect.poll(() => playing(page)).toEqual(['/placeholders/dumplings-light.svg'])
  await expect.poll(() => playing(page), { timeout: 10_000 }).toEqual([])

  expect(await peak()).toBe(1)
})

test('a Board loop scrolled off-screen stops, and the card now in the middle plays', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  const peak = await countPeakPlaying(page)
  await seedPlaceholderDishes(page)
  await gotoHydrated(page, '/')
  await expect.poll(() => playing(page), { timeout: 10_000 }).toEqual([])
  await page.getByRole('link', { name: 'Gericht dumplings' }).evaluate(el => el.scrollIntoView({ block: 'center' }))
  await expect.poll(() => playing(page)).toEqual(['/placeholders/dumplings-light.svg'])

  // Dumplings are near the top of Ideen; at the bottom they are far off-screen.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(async () => {
    const clips = await playing(page)
    return clips.length === 1 && !clips.includes('/placeholders/dumplings-light.svg')
  }).toBe(true)

  expect(await peak()).toBe(1)
})

test('hovering a card with a photo leaves the Board\'s loop to the Placeholders', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  await seedPlaceholderDishes(page, 3)
  await seedDish(page, { title: 'Mit Foto', imageUrl: await storedImage(400, 500), sourceLink: `${TIKTOK}?foto`, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')
  // First view: one of pasta, ramen and bowl plays once.
  await expect.poll(() => playing(page)).toHaveLength(1)
  const [firstView] = await playing(page)
  const other = PLACEHOLDERS.slice(0, 3).find(p => firstView !== `/placeholders/${p}-light.svg`)!

  await page.getByRole('link', { name: `Gericht ${other}` }).hover()
  await expect.poll(() => playing(page)).toEqual([`/placeholders/${other}-light.svg`])
  // On the photo: no Placeholder is hovered, so the first-view loop is back.
  await page.getByRole('link', { name: 'Mit Foto' }).hover()
  await expect.poll(() => playing(page)).toEqual([firstView])
})

test('on desktop the hovered and the lifted card loop, one at a time', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  const peak = await countPeakPlaying(page)
  await seedPlaceholderDishes(page)
  await gotoHydrated(page, '/')
  await expect.poll(() => playing(page), { timeout: 10_000 }).toEqual([])

  const bowl = page.getByRole('link', { name: 'Gericht bowl' })
  await bowl.hover()
  await expect.poll(() => playing(page)).toEqual(['/placeholders/bowl-light.svg'])
  await page.getByRole('link', { name: 'Gericht burger' }).hover()
  await expect.poll(() => playing(page)).toEqual(['/placeholders/burger-light.svg'])
  await page.mouse.move(5, 5)
  await expect.poll(() => playing(page)).toEqual([])

  // Picked up with the mouse: the lifted card loops until it is let go.
  await bowl.scrollIntoViewIfNeeded()
  const box = (await bowl.boundingBox())!
  await page.mouse.move(box.x + 30, box.y + 30)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, box.y + 60, { steps: 4 })
  const lifted = page.getByTestId('drag-card')
  await expect(lifted).toBeVisible()
  await expect.poll(() => playing(lifted)).toEqual(['/placeholders/bowl-light.svg'])
  await expect.poll(() => playing(page)).toHaveLength(1)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(lifted).toBeHidden()

  expect(await peak()).toBe(1)
})

test('with the Dish detail open beside the Board, only the detail loops', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  const peak = await countPeakPlaying(page)
  await seedPlaceholderDishes(page)
  await gotoHydrated(page, '/')
  // Opened while the Board's first-view loop plays: that one stops.
  await expect.poll(() => playing(page)).toHaveLength(1)

  const detail = await openDetail(page, 'Gericht wok')

  await expect.poll(() => playing(detail)).toEqual(['/placeholders/wok-light.svg'])
  expect(await playing(page)).toEqual(['/placeholders/wok-light.svg'])
  expect(await peak()).toBe(1)
})

test('with reduced motion no clip plays, not even in focus: stills show', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await seedPlaceholderDishes(page)
  await gotoHydrated(page, '/')

  await page.getByRole('link', { name: 'Gericht bowl' }).hover()
  const detail = await openDetail(page, 'Gericht wok')
  await expect(detail.locator('img[src="/placeholders/wok-light.svg"]')).toBeVisible()
  // Whatever would load a clip has had its chance.
  await page.waitForLoadState('networkidle')

  await expect(page.locator('video, [data-loop-svg]')).toHaveCount(0)
})

test('the picker loops its selected Placeholder only, over a quiet Board', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  const peak = await countPeakPlaying(page)
  await seedPlaceholderDishes(page)
  await gotoHydrated(page, '/')
  // Opened while the Board's first-view loop plays: that one stops.
  await expect.poll(() => playing(page)).toHaveLength(1)

  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await page.getByRole('dialog', { name: 'Gericht hinzufügen' }).getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
  const inline = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' }).getByRole('radiogroup', { name: 'Bild' })

  await expect.poll(() => playing(inline)).toEqual(['/placeholders/bowl-light.svg'])
  await inline.getByRole('radio', { name: 'Frühstück' }).click()
  await expect.poll(() => playing(inline)).toEqual(['/placeholders/breakfast-light.svg'])

  expect(await playing(page)).toEqual(['/placeholders/breakfast-light.svg'])
  expect(await peak()).toBe(1)
})

test('editing a Dish, its picker loops instead of the image above it', async ({ page }) => {
  await resetBoard(page)
  await seedDish(page, { title: 'Pancakes', placeholder: 'breakfast', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await page.emulateMedia({ colorScheme: 'light' })
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Pancakes')
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await expect.poll(() => playing(detail)).toEqual(['/placeholders/breakfast-light.svg'])

  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  const picker = page.getByRole('dialog', { name: 'Bild wählen' })
  await expect.poll(() => playing(picker)).toEqual(['/placeholders/breakfast-light.svg'])

  expect(await playing(page)).toEqual(['/placeholders/breakfast-light.svg'])
})

test('a clip takes its still\'s place without moving the layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  // Layout shifts within the Dish detail (the dev server's own toolbar
  // shifts too, outside it).
  await page.addInitScript(() => {
    type Shift = { value: number, sources: { node: Node | null }[] }
    const w = window as unknown as { layoutShift: number }
    w.layoutShift = 0
    new PerformanceObserver(list => (list.getEntries() as unknown as Shift[]).forEach((shift) => {
      if (shift.sources.some(s => s.node?.parentElement?.closest('[role="dialog"]'))) w.layoutShift += shift.value
    })).observe({ type: 'layout-shift', buffered: true })
  })
  await resetBoard(page)
  await seedDish(page, { title: 'Tacos', placeholder: 'tacos', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  const detail = await openDetail(page, 'Tacos')
  await expect.poll(() => playing(detail)).toHaveLength(1)
  // Measured once the detail has finished moving in. Loops and the
  // scroll-driven parallax never finish.
  await detail.evaluate(el => Promise.all(el.getAnimations({ subtree: true })
    .filter(a => a.timeline === document.timeline && a.effect?.getTiming().iterations !== Infinity)
    .map(a => a.finished)))

  const still = await detail.locator('img[src="/placeholders/tacos-light.svg"]').boundingBox()
  expect(await detail.locator('[data-placeholder-clip] [data-loop-svg]').boundingBox()).toEqual(still)
  expect(await page.evaluate(() => (window as unknown as { layoutShift: number }).layoutShift)).toBe(0)
})

test('a loop pauses while scrolled off-screen, and plays again when back', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await resetBoard(page)
  const note = Array.from({ length: 80 }, (_, i) => `Schritt ${i + 1}`).join('\n')
  await seedDish(page, { title: 'Ramen', placeholder: 'ramen', note, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Ramen')
  await expect.poll(() => playing(detail)).toHaveLength(1)

  await detail.evaluate(el => el.scrollTo(0, el.scrollHeight))
  await expect.poll(() => playing(detail)).toEqual([])

  await detail.evaluate(el => el.scrollTo(0, 0))
  await expect.poll(() => playing(detail)).toHaveLength(1)
})
