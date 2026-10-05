import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
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
// The Column accents, in the order the Columns take them.
const ACCENTS = ['butter', 'orchid', 'sage', 'carrot', 'sky'] as const

type Rgb = [number, number, number]

// Any CSS colour (oklab(), color-mix() results, …) as the sRGB the screen
// shows, by painting it.
async function rgb(page: Page, colours: string[]): Promise<Rgb[]> {
  return page.evaluate(colours => colours.map((colour) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = colour
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b] as Rgb
  }), colours)
}

// The Column accents and the background they are washed into.
interface Colours { palette: Rgb[], background: Rgb }
async function colours(page: Page): Promise<Colours> {
  const values = await page.evaluate(names => names.map(n => getComputedStyle(document.documentElement).getPropertyValue(`--color-${n}`)), [...ACCENTS, 'bg'])
  const resolved = await rgb(page, values)
  return { palette: resolved.slice(0, -1), background: resolved.at(-1)! }
}

// WCAG relative luminance and contrast ratio.
function contrast(a: Rgb, b: Rgb): number {
  const luminance = (c: Rgb) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }) as Rgb
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// Which accent a tint of the background was mixed from: the one that lies in
// the direction the tint moved away from the background.
function tintedWith(tint: Rgb, { palette, background }: Colours): typeof ACCENTS[number] {
  const away = (c: Rgb) => c.map((v, i) => v - background[i]!)
  const cosine = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0) / (Math.hypot(...a) * Math.hypot(...b))
  const scores = palette.map(accent => cosine(away(tint), away(accent)))
  return ACCENTS[scores.indexOf(Math.max(...scores))]!
}

// The colour stops of an element's background gradient, left to right.
async function gradientStops(locator: Locator): Promise<string[]> {
  const image = await locator.evaluate(el => getComputedStyle(el).backgroundImage)
  expect(image).toMatch(/^linear-gradient\(/)
  const args: string[] = []
  let depth = 0
  let current = ''
  for (const char of image.slice('linear-gradient('.length, -1)) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      args.push(current.trim())
      current = ''
    }
    else current += char
  }
  args.push(current.trim())
  expect(args[0]).toBe('to right')
  // A stop may carry its position after the colour.
  return args.slice(1).map(stop => stop.replace(/\s+[\d.]+%$/, ''))
}

const colourOf = (locator: Locator) => locator.evaluate(el => getComputedStyle(el).color)
const backgroundOf = (locator: Locator) => locator.evaluate(el => getComputedStyle(el).backgroundColor)

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

    await page.mouse.up()
    await expect(page.getByTestId('drag-card')).toHaveCount(0)
    await expect.poll(async () => (await dropWash(page)).opacity).toBe('0')
  })
}
