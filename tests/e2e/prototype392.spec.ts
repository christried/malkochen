import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { resetBoard, seedDish } from './seed'

// PROTOTYPE #392: throwaway, never merge. Not a test: takes the prototype's
// screenshots (the Changelog page, the Changelog Popup, the Notification
// Prompt, the Dish Link page and the Dish detail's share buttons; each variant
// in light and dark, on a 360px phone and on a desktop) into
// prototype392/shots/. Only with P392_SHOTS=1:
// `P392_SHOTS=1 bash <slot> pnpm test:e2e tests/e2e/prototype392.spec.ts`.
test.describe.configure({ mode: 'serial' })
test.skip(!process.env.P392_SHOTS, 'Screenshots for the #392 prototype only')
test.setTimeout(900_000)

const ME = 'hamilton@example.com'
const OTHER = 'johnson@example.com'
const OUT = 'prototype392/shots'
const THEMES = ['light', 'dark'] as const
const PHONE = { width: 360, height: 780 }
const DESKTOP = { width: 1280, height: 820 }
const SIZES = [['phone', PHONE], ['desktop', DESKTOP]] as const

let boardPath = ''

async function settle(page: Page, ms = 1200) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(ms)
}

function withQuery(path: string, picks: Record<string, string>) {
  return `${path}?${new URLSearchParams({ ...picks, bar: '0' })}`
}

test('set up the Board', async ({ page, browser }) => {
  const other = await newTab(browser)
  await signIn(other, OTHER, { name: 'Mira' })
  await other.context().close()
  await signIn(page, ME, { name: 'Kim' })
  await resetBoard(page)
  await seedDish(page, { title: 'Cremige Pilzpasta', sourceLink: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', sourceKind: 'tiktok', placeholder: 'pasta', creator: 'pastaqueen' })
  await seedDish(page, { title: 'Shakshuka', sourceLink: 'https://www.instagram.com/reel/C1a2b3c4d5e/', sourceKind: 'instagram-reel', placeholder: 'breakfast', addedBy: OTHER })
  await gotoHydrated(page, '/')
  await expect(page.getByRole('link', { name: 'Cremige Pilzpasta' })).toBeVisible()
  boardPath = new URL(page.url()).pathname
})

for (const theme of THEMES) {
  test(`Changelog page, ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    for (const variant of ['A', 'B', 'C'] as const) {
      for (const [size, viewport] of SIZES) {
        await page.setViewportSize(viewport)
        await gotoHydrated(page, withQuery('/changelog', { changelog: variant }))
        await settle(page)
        await page.screenshot({ path: `${OUT}/changelog-${variant}-${size}-${theme}.png`, fullPage: true })
      }
    }
  })

  test(`Changelog Popup, ${theme}`, async ({ page }) => {
    await signIn(page, ME, { name: 'Kim' })
    await page.emulateMedia({ colorScheme: theme })
    for (const variant of ['A', 'B', 'C'] as const) {
      for (const [size, viewport] of SIZES) {
        await page.setViewportSize(viewport)
        await gotoHydrated(page, withQuery(boardPath, { popup: variant }))
        await settle(page, 1500)
        await page.screenshot({ path: `${OUT}/popup-${variant}-${size}-${theme}.png` })
      }
    }
  })

  test(`Notification Prompt, ${theme}`, async ({ page }) => {
    await signIn(page, ME, { name: 'Kim' })
    await page.emulateMedia({ colorScheme: theme })
    for (const which of ['push', 'digest'] as const) {
      for (const variant of ['A', 'B'] as const) {
        for (const [size, viewport] of SIZES) {
          await page.setViewportSize(viewport)
          await gotoHydrated(page, withQuery(boardPath, { prompt: variant, which }))
          await settle(page, 1500)
          await page.screenshot({ path: `${OUT}/prompt-${which}-${variant}-${size}-${theme}.png` })
        }
      }
    }
  })

  test(`Dish Link page and share buttons, ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    for (const variant of ['A', 'B', 'C'] as const) {
      for (const share of ['A', 'B'] as const) {
        for (const [size, viewport] of SIZES) {
          await page.setViewportSize(viewport)
          await gotoHydrated(page, withQuery('/prototype392/dish', { dish: variant, share }))
          await settle(page)
          await page.screenshot({ path: `${OUT}/dish-${variant}-share${share}-${size}-${theme}.png`, fullPage: true })
        }
      }
    }
  })
}
