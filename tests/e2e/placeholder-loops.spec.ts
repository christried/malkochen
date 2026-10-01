import { expect, test, type Locator, type Page } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { PLACEHOLDERS } from '../../shared/placeholders'
import { resetBoard, seedDish } from './seed'

// Placeholder Image loops (PRD stories 83–85; handoff illustrations.json
// "rules"): a Placeholder loops only in focus (the Dish detail, the picker's
// selection, a lifted or hovered card) and once on first view and when
// scrolling stops; never more than one loop on the Board, none off-screen,
// none with reduced motion. Ruth's Board is used by this file only.
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// The clips playing inside `scope`, by the file they play.
function playing(scope: Page | Locator) {
  return scope.locator('video').evaluateAll(videos => (videos as HTMLVideoElement[])
    .filter(v => !v.paused && !v.ended && v.currentTime > 0)
    .map(v => new URL(v.currentSrc).pathname))
}

// Keeps count, in the page, of the most clips ever playing at once.
async function countPeakPlaying(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { peakPlaying: number }
    w.peakPlaying = 0
    document.addEventListener('playing', () => {
      const now = [...document.querySelectorAll('video')].filter(v => !v.paused).length
      w.peakPlaying = Math.max(w.peakPlaying, now)
    }, true)
  })
  return () => page.evaluate(() => (window as unknown as { peakPlaying: number }).peakPlaying)
}

// A Board full of Placeholder Dishes, each with its own Placeholder, in Ideen.
async function seedPlaceholderDishes(page: Page) {
  await resetBoard(page)
  for (const placeholder of PLACEHOLDERS.slice(0, 12)) {
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

test('the Dish detail loops its Placeholder in the current theme', async ({ page }) => {
  await resetBoard(page)
  await seedDish(page, { title: 'Spaghetti', placeholder: 'pasta', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await page.emulateMedia({ colorScheme: 'dark' })
  await gotoHydrated(page, '/')

  const detail = await openDetail(page, 'Spaghetti')

  await expect.poll(() => playing(detail)).toEqual(['/placeholders/pasta-dark.webm'])
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
  await page.getByRole('link', { name: 'Gericht porridge' }).evaluate(el => el.scrollIntoView({ block: 'center' }))
  await expect.poll(() => playing(page)).toEqual(['/placeholders/porridge-light.webm'])
  await expect.poll(() => playing(page), { timeout: 10_000 }).toEqual([])

  expect(await peak()).toBe(1)
})

test('on desktop the hovered and the lifted card loop, one at a time', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  const peak = await countPeakPlaying(page)
  await seedPlaceholderDishes(page)
  await gotoHydrated(page, '/')
  await expect.poll(() => playing(page), { timeout: 10_000 }).toEqual([])

  const curry = page.getByRole('link', { name: 'Gericht curry' })
  await curry.hover()
  await expect.poll(() => playing(page)).toEqual(['/placeholders/curry-light.webm'])
  await page.getByRole('link', { name: 'Gericht salad' }).hover()
  await expect.poll(() => playing(page)).toEqual(['/placeholders/salad-light.webm'])
  await page.mouse.move(5, 5)
  await expect.poll(() => playing(page)).toEqual([])

  // Picked up with the mouse: the lifted card loops until it is let go.
  const box = (await curry.boundingBox())!
  await page.mouse.move(box.x + 30, box.y + 30)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, box.y + 60, { steps: 4 })
  const lifted = page.getByTestId('drag-card')
  await expect(lifted).toBeVisible()
  await expect.poll(() => playing(lifted)).toEqual(['/placeholders/curry-light.webm'])
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

  await expect.poll(() => playing(detail)).toEqual(['/placeholders/wok-light.webm'])
  expect(await playing(page)).toEqual(['/placeholders/wok-light.webm'])
  expect(await peak()).toBe(1)
})

test('with reduced motion no clip plays, not even in focus: stills show', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await seedPlaceholderDishes(page)
  await gotoHydrated(page, '/')

  await page.getByRole('link', { name: 'Gericht curry' }).hover()
  const detail = await openDetail(page, 'Gericht wok')
  await expect(detail.locator('img[src="/placeholders/wok-light.svg"]')).toBeVisible()
  await page.waitForTimeout(1_000)

  await expect(page.locator('video')).toHaveCount(0)
})

test('the picker loops its selected Placeholder only', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await page.getByRole('dialog', { name: 'Gericht hinzufügen' }).getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
  const inline = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' }).getByRole('radiogroup', { name: 'Bild' })

  await expect.poll(() => playing(inline)).toEqual(['/placeholders/bowl-light.webm'])

  await inline.getByRole('radio', { name: 'Curry' }).click()
  await expect.poll(() => playing(inline)).toEqual(['/placeholders/curry-light.webm'])
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

  const still = await detail.locator('img[src="/placeholders/tacos-light.svg"]').boundingBox()
  expect(await detail.locator('video').boundingBox()).toEqual(still)
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
