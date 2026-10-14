import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column, tab } from './board'
import { ACCENTS, backgroundOf, colourOf, colours, contrast, gradientStops, rgb, tintedWith, type Rgb } from './colour'
import { gotoHydrated } from './hydration'
import { resetBoard, seedDish, setColumns } from './seed'

// Colour on desktop (#122): each Column's lane is tinted in its own accent,
// over a page that is a soft gradient across the Column accents from left to
// right, in light and dark, with text staying readable (WCAG AA). Dragging a
// Dish over another lane tints the page in that lane's accent, as before.
// Chien-Shiung's Board is used by this file only.
test.describe.configure({ mode: 'serial' })

const CHIEN_SHIUNG = ALLOWLISTED[23]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const DESKTOP = { width: 1280, height: 900 }

for (const scheme of ['light', 'dark'] as const) {
  test(`desktop (${scheme}): each Column is tinted in its own accent, its title, subtitle and empty state readable`, async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.emulateMedia({ colorScheme: scheme })
    await signIn(page, CHIEN_SHIUNG)
    await resetBoard(page)
    // One Dish, so the other Columns show their empty state.
    await seedDish(page, { title: 'Curry', sourceLink: TIKTOK, sourceKind: 'tiktok' })
    await gotoHydrated(page, '/')
    const known = await colours(page)

    const names = ['Ideen', 'Diese Woche', 'Gekocht']
    const lanes = await Promise.all(names.map(async name => (await rgb(page, [await backgroundOf(column(page, name))]))[0]!))
    expect(lanes.map(lane => tintedWith(lane, known))).toEqual(['butter', 'orchid', 'sage'])
    expect(new Set(lanes.map(String)).size).toBe(3)

    for (const [i, name] of names.entries()) {
      const lane = column(page, name)
      const texts = [lane.getByRole('heading', { level: 2 }), ...await lane.locator('hgroup p, [data-empty] p').all()]
      expect(texts.length).toBeGreaterThan(1)
      for (const text of texts) {
        const [ink] = await rgb(page, [await colourOf(text)])
        expect(contrast(ink!, lanes[i]!), `${await text.textContent()} on ${name}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
}

for (const [count, scheme] of [[2, 'light'], [3, 'dark'], [6, 'light'], [6, 'dark']] as const) {
  test(`desktop (${scheme}): with ${count} Columns the page is a gradient across their accents, its text readable`, async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.emulateMedia({ colorScheme: scheme })
    await signIn(page, CHIEN_SHIUNG)
    await setColumns(page, ['Ideen', 'Diese Woche', 'Bald', 'Irgendwann', 'Vielleicht', 'Gekocht'].slice(-count))
    await gotoHydrated(page, '/')
    const known = await colours(page)

    const stops = await rgb(page, await gradientStops(page.locator('main.board')))
    expect(stops.map(stop => tintedWith(stop, known))).toEqual(Array.from({ length: count }, (_, i) => ACCENTS[i % ACCENTS.length]))
    // The Board's name stays readable over all of it.
    const [ink] = await rgb(page, [await colourOf(page.getByRole('heading', { level: 1 }))])
    for (const stop of stops) expect(contrast(ink!, stop)).toBeGreaterThanOrEqual(4.5)
  })
}

// The wash over the page while a Dish is dragged over a lane.
function dropWash(page: Page) {
  return page.locator('main.board').evaluate((el) => {
    const style = getComputedStyle(el, '::before')
    return { opacity: style.opacity, colour: style.backgroundColor, transition: style.transitionDuration }
  })
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`desktop (${reducedMotion === 'reduce' ? 'reduced motion' : 'motion'}): dragging a Dish over another Column tints the page in its accent until it is dropped`, async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await page.emulateMedia({ reducedMotion })
    await signIn(page, CHIEN_SHIUNG)
    await resetBoard(page)
    await seedDish(page, { title: 'Curry', sourceLink: TIKTOK, sourceKind: 'tiktok' })
    await gotoHydrated(page, '/')
    const known = await colours(page)
    expect((await dropWash(page)).opacity).toBe('0')

    const card = (await page.getByRole('link', { name: 'Curry', exact: true }).boundingBox())!
    const lane = (await column(page, 'Diese Woche').boundingBox())!
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
    await page.mouse.down()
    await page.mouse.move(lane.x + lane.width / 2, card.y + card.height / 2, { steps: 12 })
    await expect(column(page, 'Diese Woche')).toHaveClass(/lane-target/)

    await expect.poll(async () => (await dropWash(page)).opacity).toBe('1')
    const wash = await dropWash(page)
    expect(tintedWith((await rgb(page, [wash.colour]))[0]!, known)).toBe('orchid')
    // Reduced motion: the tint changes at once.
    if (reducedMotion === 'reduce') expect(wash.transition.split(', ').every(d => d === '0s')).toBe(true)
    // The lane fills more, its subtitle still readable on it.
    const target = column(page, 'Diese Woche')
    await target.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    const [fill, subtitle] = await rgb(page, [await backgroundOf(target), await colourOf(target.locator('hgroup p'))])
    expect(tintedWith(fill!, known)).toBe('orchid')
    expect(contrast(subtitle!, fill!)).toBeGreaterThanOrEqual(4.5)

    await page.mouse.up()
    await expect(page.getByTestId('drag-card')).toHaveCount(0)
    await expect.poll(async () => (await dropWash(page)).opacity).toBe('0')
  })
}

// How far a colour lies from `from` toward `to` (`share` of the way), and how
// far off that line it is.
function along(colour: Rgb, from: Rgb, to: Rgb) {
  const way = to.map((v, i) => v - from[i]!)
  const moved = colour.map((v, i) => v - from[i]!)
  const share = moved.reduce((sum, v, i) => sum + v * way[i]!, 0) / way.reduce((sum, v) => sum + v * v, 0)
  return { share, off: Math.hypot(...moved.map((v, i) => v - share * way[i]!)) }
}

// The blob behind „Noch nichts hier." (#215), the empty Board's and the
// empty Columns', is the colour of its lane, a little fuller toward the
// lane's accent: on the tinted lanes once every Column shows, and on the
// phone's plain ones, in light and dark.
for (const scheme of ['light', 'dark'] as const) {
  for (const [layout, size] of [['desktop', DESKTOP], ['phone', { width: 400, height: 860 }]] as const) {
    test(`${layout} (${scheme}): the blob behind an empty Column's „Noch nichts hier." is its lane's colour`, async ({ page }) => {
      await page.setViewportSize(size)
      await page.emulateMedia({ colorScheme: scheme })
      await signIn(page, CHIEN_SHIUNG)
      await resetBoard(page)
      await gotoHydrated(page, '/')
      const { palette } = await colours(page)

      // The empty Board's in the first, the empty Columns' in the others.
      for (const [i, name] of ['Ideen', 'Diese Woche', 'Gekocht'].entries()) {
        if (layout === 'phone') await tab(page, `${name} 0`).click()
        const lane = column(page, name)
        const blob = lane.locator('[data-blob]')
        await expect(blob).toBeVisible()
        const [fill, behind] = await rgb(page, [await blob.evaluate(el => getComputedStyle(el).fill), await backgroundOf(lane)])
        const { share, off } = along(fill!, behind!, palette[i]!)
        expect(share, `${name}: toward its accent`).toBeGreaterThan(0.05)
        expect(share, `${name}: still near its lane`).toBeLessThan(0.25)
        expect(off, `${name}: no other colour`).toBeLessThan(8)
      }
    })
  }
}
