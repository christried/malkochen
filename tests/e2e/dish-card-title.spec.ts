import type { Locator, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { cardAtRest, column } from './board'
import { gotoHydrated } from './hydration'
import { resetBoard, seedDish } from './seed'

// A Dish card's title (PRD story 9): at most two lines, ending in an
// ellipsis, with nothing of a third line showing; the full title comes up on
// hover or keyboard focus, and screen readers always get all of it.
// Rosalind's Board is used by this file only.

test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const LONG = 'Knuspriger Sesam-Tofu mit Erdnusssoße und Frühlingszwiebeln'
// Every word starts with a capital whose umlaut reaches above the line: the
// ones that start a third line are what used to peek out under the second.
const UMLAUTS = 'Überbackene Äpfel Über Öl Über Äpfel Über Öl Über Äpfel Über Öl'
const SHORT = 'Linsensuppe'
// As long as a title can be (200 characters).
const LONGEST = 'Ofengemüse mit Kichererbsen, Tahini-Dressing, Granatapfelkernen, gerösteten Mandeln, frischer Minze und Zitronenzeste, dazu Fladenbrot aus der Pfanne und ein Joghurt-Dip aus Soja mit Knoblauch & Salz.'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

function title(page: Page, text: string) {
  return column(page, 'Ideen').getByRole('heading', { level: 3, name: text })
}

function card(page: Page, text: string) {
  return column(page, 'Ideen').getByRole('link', { name: text, exact: true })
}

function fullTitleTip(page: Page, text: string) {
  return card(page, text).locator('[data-title-tip]')
}

// The darkest and lightest red, green and blue across the title's last pixel
// row (the page renders at 1px per CSS pixel): one colour all along when only
// the card shows there, nothing of a line below.
async function lastRowColours(page: Page, heading: Locator) {
  const box = (await heading.boundingBox())!
  const png = await page.screenshot({
    clip: { x: Math.ceil(box.x), y: Math.floor(box.y + box.height) - 1, width: Math.floor(box.width) - 1, height: 1 },
  })
  return page.evaluate(async (base64) => {
    // Not fetch() of a data: URL: the Content Security Policy only lets the
    // page connect to its own origin.
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data
    let spread = 0
    for (let channel = 0; channel < 3; channel++) {
      const values = pixels.filter((_, i) => i % 4 === channel)
      spread = Math.max(spread, Math.max(...values) - Math.min(...values))
    }
    return spread
  }, png.toString('base64'))
}

test.beforeAll(async ({ browser }) => {
  const page = await newTab(browser)
  await signIn(page, ALLOWLISTED[22])
  await resetBoard(page)
  // The first seeded ends up at the bottom of Ideen.
  for (const text of [LONGEST, LONG, UMLAUTS, SHORT]) await seedDish(page, { title: text, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await page.context().close()
})

for (const [device, size] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
  test(`a long title shows exactly two lines on a ${device}`, async ({ page }) => {
    await page.setViewportSize(size)
    await signIn(page, ALLOWLISTED[22])
    await gotoHydrated(page, '/')
    await page.evaluate(() => document.fonts.ready)

    for (const text of [LONG, UMLAUTS]) {
      const heading = title(page, text)
      await cardAtRest(heading)
      const lines = await heading.evaluate((el) => {
        const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight)
        return { shown: Math.round(el.getBoundingClientRect().height / lineHeight * 10) / 10, clamped: el.scrollHeight > el.clientHeight }
      })
      expect(lines).toEqual({ shown: 2, clamped: true })
      // The browser ends the second line in "…".
      await expect(heading).toHaveCSS('-webkit-line-clamp', '2')
      expect(await lastRowColours(page, heading), `nothing of ${text}'s third line shows`).toBeLessThanOrEqual(8)
    }
  })
}

test('the lines cut off give the lanes nothing to scroll down to', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, ALLOWLISTED[22])
  await gotoHydrated(page, '/')
  const heading = title(page, LONGEST)
  await cardAtRest(heading)

  // The lanes scroll sideways; the longest title, on the last card of the
  // tallest lane, mustn't give them anything to scroll down to.
  const scrollableDown = await heading.evaluate((el) => {
    let lanes = el.parentElement
    while (lanes && getComputedStyle(lanes).overflowX !== 'auto') lanes = lanes.parentElement
    return lanes!.scrollHeight - lanes!.clientHeight
  })
  expect(scrollableDown).toBe(0)
})

test('hovering a card with a cut title shows the full title, and keyboard focus does too', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, ALLOWLISTED[22])
  await gotoHydrated(page, '/')
  await cardAtRest(card(page, LONG))

  const tip = fullTitleTip(page, LONG)
  await expect(tip).toBeHidden()
  await card(page, LONG).hover()
  await expect(tip).toBeVisible()
  await expect(tip).toHaveText(LONG)

  await page.mouse.move(0, 0)
  await expect(tip).toBeHidden()
  await card(page, LONG).focus()
  await expect(tip).toBeVisible()

  // A title that fits needs no second copy. Every card has been measured by
  // now: the tip above came from the same measuring.
  await card(page, SHORT).hover()
  await expect(fullTitleTip(page, SHORT)).toHaveCount(0)
  await expect(fullTitleTip(page, LONGEST)).toHaveCount(1)
})

test('screen readers get the whole title, cut or not', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, ALLOWLISTED[22])
  await gotoHydrated(page, '/')

  await expect(card(page, LONG)).toBeVisible()
  await expect(title(page, LONG)).toHaveAccessibleName(LONG)
  await expect(card(page, LONG)).toHaveAccessibleName(LONG)
  // The full title on hover is for the eyes only: it isn't read twice.
  await card(page, LONG).hover()
  await expect(fullTitleTip(page, LONG)).toHaveAttribute('aria-hidden', 'true')
})
