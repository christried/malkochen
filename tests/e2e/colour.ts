import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

// Reading the colours the screen shows: the Column accents and what is
// tinted with them (the lanes, the page, the Board switcher's pill).

// The Column accents, in the order the Columns take them.
export const ACCENTS = ['butter', 'orchid', 'sage', 'carrot', 'sky'] as const

export type Rgb = [number, number, number]

// Any CSS colour (oklab(), color-mix() results, …) as the sRGB the screen
// shows, by painting it.
export async function rgb(page: Page, colours: string[]): Promise<Rgb[]> {
  return page.evaluate(colours => colours.map((colour) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = colour
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, g, b] as Rgb
  }), colours)
}

// The Column accents and the background they are washed into: the page's
// (`bg`), or the `surface` colour for what sits on the page.
export interface Colours { palette: Rgb[], background: Rgb }
export async function colours(page: Page, into: 'bg' | 'surface' = 'bg'): Promise<Colours> {
  const values = await page.evaluate(names => names.map(n => getComputedStyle(document.documentElement).getPropertyValue(`--color-${n}`)), [...ACCENTS, into])
  const resolved = await rgb(page, values)
  return { palette: resolved.slice(0, -1), background: resolved.at(-1)! }
}

// WCAG relative luminance and contrast ratio.
export function contrast(a: Rgb, b: Rgb): number {
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
export function tintedWith(tint: Rgb, { palette, background }: Colours): typeof ACCENTS[number] {
  const away = (c: Rgb) => c.map((v, i) => v - background[i]!)
  const cosine = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i]!, 0) / (Math.hypot(...a) * Math.hypot(...b))
  const scores = palette.map(accent => cosine(away(tint), away(accent)))
  return ACCENTS[scores.indexOf(Math.max(...scores))]!
}

// The colour stops of an element's background gradient, left to right.
export async function gradientStops(locator: Locator): Promise<string[]> {
  const args = await gradientArgs(locator, 'linear-gradient')
  expect(args[0]).toBe('to right')
  // A stop may carry its position after the colour.
  return args.slice(1).map(stop => stop.replace(/\s+[\d.]+%$/, ''))
}

// The colours of an element's aura (#285, main.css `.aura`): its conic
// gradient's stops after the transparent half, in turn. At rest (0deg) the
// browser leaves out its `from`.
export async function auraColours(locator: Locator): Promise<string[]> {
  const args = await gradientArgs(locator, 'conic-gradient')
  const stops = args[0]!.startsWith('from ') ? args.slice(1) : args
  expect(stops[0]).toMatch(/^(transparent|rgba\(0, 0, 0, 0\)) 180deg$/)
  return stops.slice(1)
}

// How far an element's aura has turned, in degrees.
export async function auraAngle(locator: Locator): Promise<number> {
  return locator.evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--aura-angle')))
}

// The top-level arguments of an element's background gradient of `kind`.
async function gradientArgs(locator: Locator, kind: string): Promise<string[]> {
  const image = await locator.evaluate(el => getComputedStyle(el).backgroundImage)
  expect(image.startsWith(`${kind}(`)).toBe(true)
  const args: string[] = []
  let depth = 0
  let current = ''
  for (const char of image.slice(kind.length + 1, -1)) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      args.push(current.trim())
      current = ''
    }
    else current += char
  }
  args.push(current.trim())
  return args
}

export const colourOf = (locator: Locator) => locator.evaluate(el => getComputedStyle(el).color)
export const backgroundOf = (locator: Locator) => locator.evaluate(el => getComputedStyle(el).backgroundColor)
