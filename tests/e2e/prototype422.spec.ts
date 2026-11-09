import { mkdir } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import pg from 'pg'
import { expect, newTab, test } from './fixtures'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { landingBoardId, resetBoard, seedDish } from './seed'
import { SPLASH_SEEN_KEY } from '../../shared/splash'

// PROTOTYPE #422: throwaway, never merge. Not a test: takes the prototype's
// screenshots (the Snackbert Question, the report sheet, the confirmation
// and "Snackbert melden" in the Dish History; each variant in light and
// dark, on a 360px phone and on a desktop) into prototype422/shots/, and
// short videos of how he comes in into prototype422/videos/. Only with
// P422_SHOTS=1: `P422_SHOTS=1 pnpm test:e2e tests/e2e/prototype422.spec.ts`.
test.describe.configure({ mode: 'serial' })
test.skip(!process.env.P422_SHOTS, 'Screenshots for the #422 prototype only')
test.setTimeout(1_800_000)

const ME = 'hamilton@example.com'
const OTHER = 'johnson@example.com'
const OUT = 'prototype422/shots'
const THEMES = ['light', 'dark'] as const
const PHONE = { width: 360, height: 780 }
const DESKTOP = { width: 1280, height: 820 }
const SIZES = [['phone', PHONE], ['desktop', DESKTOP]] as const

let boardPath = ''
let dishPath = ''

async function settle(page: Page, ms = 1200) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(ms)
}

function withQuery(path: string, picks: Record<string, string>) {
  return `${path}?${new URLSearchParams({ ...picks, bar: '0' })}`
}

// Two Cookings of the Dish: one the signed-in Member recorded, one the other.
async function seedOwnCookings() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `insert into cooking (dish_id, cooked_at, recorded_by)
       select d.id, now() - interval '9 days', (select id from "user" where email = $2) from dish d where d.title = $1
       union all
       select d.id, now() - interval '2 hours', (select id from "user" where email = $3) from dish d where d.title = $1`,
      ['Cremige Pilzpasta', OTHER, ME],
    )
  }
  finally {
    await client.end()
  }
}

test('set up the Board', async ({ page, browser }) => {
  await mkdir(OUT, { recursive: true })
  const other = await newTab(browser)
  await signIn(other, OTHER, { name: 'Mira' })
  await other.context().close()
  await signIn(page, ME, { name: 'Kim' })
  await resetBoard(page)
  await seedDish(page, { title: 'Shakshuka', sourceLink: 'https://www.instagram.com/reel/C1a2b3c4d5e/', sourceKind: 'instagram-reel', placeholder: 'breakfast', addedBy: OTHER })
  await seedDish(page, { title: 'Cremige Pilzpasta', sourceLink: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', sourceKind: 'tiktok', placeholder: 'pasta', creator: 'pastaqueen', addedBy: ME })
  await seedOwnCookings()
  await landingBoardId(page)
  await gotoHydrated(page, '/')
  await expect(page.getByRole('link', { name: 'Cremige Pilzpasta' })).toBeVisible()
  boardPath = new URL(page.url()).pathname
  await page.getByRole('link', { name: 'Cremige Pilzpasta' }).click()
  await page.waitForURL(url => url.pathname.split('/').length > 3)
  dishPath = new URL(page.url()).pathname
})

for (const theme of THEMES) {
  test(`Snackbert Question, ${theme}`, async ({ page }) => {
    await signIn(page, ME, { name: 'Kim' })
    await page.emulateMedia({ colorScheme: theme })
    for (const frage of ['A', 'B', 'C'] as const) {
      for (const blase of ['A', 'B', 'C'] as const) {
        for (const [size, viewport] of SIZES) {
          await page.setViewportSize(viewport)
          await gotoHydrated(page, withQuery(boardPath, { frage, blase, wie: 'slide', text: '1', zeigen: '1' }))
          await expect(page.locator('[data-p422-question]')).toBeVisible()
          await settle(page, 1600)
          await page.screenshot({ path: `${OUT}/frage-${frage}-blase${blase}-${size}-${theme}.png` })
        }
      }
    }
  })

  test(`Report sheet, ${theme}`, async ({ page }) => {
    await signIn(page, ME, { name: 'Kim' })
    await page.emulateMedia({ colorScheme: theme })
    const states = {
      leer: {},
      voll: { foto: '1', aufnahme: 'done', worte: '1' },
      aufnahme: { aufnahme: 'rec' },
    } as Record<string, Record<string, string>>
    for (const blatt of ['A', 'B', 'C'] as const) {
      for (const [state, extra] of Object.entries(states)) {
        for (const [size, viewport] of SIZES) {
          await page.setViewportSize(viewport)
          await gotoHydrated(page, withQuery(boardPath, { blatt, offen: '1', ...extra }))
          await expect(page.locator(`[data-p422-sheet="${blatt}"]`)).toBeVisible()
          await settle(page, 900)
          await page.screenshot({ path: `${OUT}/blatt-${blatt}-${state}-${size}-${theme}.png` })
        }
      }
    }
  })

  test(`Confirmation, ${theme}`, async ({ page }) => {
    await signIn(page, ME, { name: 'Kim' })
    await page.emulateMedia({ colorScheme: theme })
    for (const [size, viewport] of SIZES) {
      await page.setViewportSize(viewport)
      await gotoHydrated(page, withQuery(boardPath, { danke: 'A', blatt: 'A', offen: '1', worte: '1' }))
      await page.locator('[data-p422-sheet="A"]').getByRole('button', { name: 'Senden', exact: true }).click()
      await expect(page.locator('[data-p422-sent]')).toBeVisible()
      await settle(page, 900)
      await page.screenshot({ path: `${OUT}/danke-A-${size}-${theme}.png` })
      for (const danke of ['B', 'C'] as const) {
        await gotoHydrated(page, withQuery(boardPath, { danke, 'danke-zeigen': '1', 'danke-bleibt': '1' }))
        await expect(page.locator(`[data-p422-thanks="${danke}"]`)).toBeVisible()
        await settle(page, 1200)
        await page.screenshot({ path: `${OUT}/danke-${danke}-${size}-${theme}.png` })
      }
    }
  })

  test(`Snackbert melden in the Dish History, ${theme}`, async ({ page }) => {
    await signIn(page, ME, { name: 'Kim' })
    await page.emulateMedia({ colorScheme: theme })
    for (const melden of ['A', 'B', 'C'] as const) {
      for (const gemeldet of ['0', '1'] as const) {
        for (const [size, viewport] of SIZES) {
          await page.setViewportSize(viewport)
          await gotoHydrated(page, withQuery(dishPath, { melden, gemeldet }))
          const history = page.locator('[data-dish-history]')
          await expect(page.locator(`[data-p422-melden="${melden}"]`)).toBeVisible()
          await settle(page, 900)
          await page.locator('[data-comment-form]').scrollIntoViewIfNeeded()
          await settle(page, 600)
          await history.screenshot({ path: `${OUT}/melden-${melden}-${gemeldet === '1' ? 'gemeldet' : 'offen'}-${size}-${theme}.png` })
        }
      }
    }
  })
}

// How he comes in: a short video for each place and way, phone, light,
// from the Board's opening to his leaving after "Nein".
test('Videos of the Question', async ({ page, browser }) => {
  await signIn(page, ME, { name: 'Kim' })
  const storageState = await page.context().storageState()
  for (const frage of ['A', 'B', 'C'] as const) {
    for (const wie of ['slide', 'peek', 'bounce'] as const) {
      const context = await browser.newContext({ viewport: PHONE, storageState, recordVideo: { dir: 'prototype422/videos/raw', size: PHONE }, colorScheme: 'light' })
      await context.addInitScript(key => sessionStorage.setItem(key, '1'), SPLASH_SEEN_KEY)
      const recorded = await context.newPage()
      await gotoHydrated(recorded, withQuery(boardPath, { frage, wie, blase: 'A', text: '2', zeigen: '1' }))
      await recorded.locator('[data-p422-question]').waitFor()
      await recorded.waitForTimeout(2800)
      await recorded.locator('[data-p422-question] .p422-no').click()
      await recorded.waitForTimeout(2600)
      const video = recorded.video()
      await context.close()
      await video?.saveAs(`prototype422/videos/frage-${frage}-${wie}.webm`)
    }
  }
})
