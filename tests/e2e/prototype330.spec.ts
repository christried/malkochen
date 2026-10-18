import type { Locator, Page } from '@playwright/test'
import pg from 'pg'
import { expect, newTab, test } from './fixtures'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { landingBoardId, resetBoard } from './seed'

// PROTOTYPE #330: throwaway, never merge. Not a test: takes the prototype's
// screenshots (card, Verlauf, Gekocht toast; each variant in light and dark,
// on a 360px phone and on a desktop) into prototype330/shots/. Only with
// P330_SHOTS=1: `P330_SHOTS=1 pnpm test:e2e tests/e2e/prototype330.spec.ts`.
test.describe.configure({ mode: 'serial' })
test.skip(!process.env.P330_SHOTS, 'Screenshots for the #330 prototype only')
test.setTimeout(600_000)

const ME = 'hamilton@example.com'
const OTHER = 'johnson@example.com'
const OUT = 'prototype330/shots'
const VARIANTS = ['A', 'B', 'C'] as const
const THEMES = ['light', 'dark'] as const
const PHONE = { width: 360, height: 780 }
const DESKTOP = { width: 1280, height: 820 }

let boardPath = ''

async function sql(text: string, values: unknown[] = []) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    return (await client.query(text, values)).rows
  }
  finally {
    await client.end()
  }
}

// The screenshot Board: what each Dish's made-up life is is in
// app/utils/prototype330.ts (PICKED).
async function seedBoard(page: Page) {
  const boardId = await landingBoardId(page)
  const [{ id: me }] = await sql('select id from "user" where email = $1', [ME])
  const [{ id: other }] = await sql('select id from "user" where email = $1', [OTHER])
  await sql('insert into membership (board_id, user_id) values ($1, $2) on conflict do nothing', [boardId, other])
  await sql(`update membership set seen_at = now() - interval '1 hour', new_since = now() - interval '1 hour' where board_id = $1 and user_id = $2`, [boardId, me])
  const columns = (await sql('select id from board_column where board_id = $1 order by position', [boardId])).map(r => r.id as string)
  const dishes: { title: string, column: number, by: string, placeholder: string, kind: string, link: string, creator?: string, daysAgo: number, cookings: number[] }[] = [
    { title: 'Shakshuka', column: 0, by: other, placeholder: 'breakfast', kind: 'instagram-reel', link: 'https://www.instagram.com/reel/C1a2b3c4d5e/', daysAgo: 0.01, cookings: [] },
    { title: 'Cremige Pilzpasta', column: 0, by: me, placeholder: 'pasta', kind: 'tiktok', link: 'https://www.tiktok.com/@scout2015/video/6718335390845095173', creator: 'pastaqueen', daysAgo: 30, cookings: [21, 9, 2] },
    { title: 'Ofengemüse mit Tahini und einer sehr langen Beschreibung', column: 0, by: other, placeholder: 'bowl', kind: 'blog', link: 'https://www.example.com/ofengemuese', creator: 'Zucker & Jagdwurst', daysAgo: 20, cookings: [6] },
    { title: 'Gnocchi aus dem Ofen', column: 0, by: me, placeholder: 'eintopf', kind: 'youtube-short', link: 'https://www.youtube.com/shorts/abcdefghijk', daysAgo: 12, cookings: [4] },
    { title: 'Kimchi-Pfannkuchen', column: 0, by: other, placeholder: 'dumplings', kind: 'pinterest-pin', link: 'https://www.pinterest.com/pin/123456789/', daysAgo: 5, cookings: [] },
    { title: 'Linsen-Dal mit Kokosmilch', column: 2, by: other, placeholder: 'eintopf', kind: 'blog', link: 'https://www.example.com/dal', creator: 'Bianca Zapatka', daysAgo: 40, cookings: [15, 3] },
  ]
  for (const [position, d] of dishes.reverse().entries()) {
    const [{ id }] = await sql(
      `insert into dish (board_id, column_id, position, title, placeholder, source_link, source_kind, added_by, creator, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - $10::float8 * interval '1 day') returning id`,
      [boardId, columns[d.column], -position, d.title, d.placeholder, d.link, d.kind, d.by, d.creator ?? null, d.daysAgo],
    )
    for (const [i, days] of d.cookings.entries()) {
      await sql(`insert into cooking (dish_id, cooked_at, recorded_by) values ($1, now() - make_interval(days => $2), $3)`, [id, days, i % 2 ? other : me])
    }
  }
}

function at(path: string, picks: Record<string, string>) {
  return `${path}?${new URLSearchParams({ ...picks, bar: '0' })}`
}

// Shakshuka stays a New Dish: the Board's next open counts from an hour ago.
async function unseen() {
  await sql(`update membership m set seen_at = now() - interval '1 hour', new_since = now() - interval '1 hour'
             from "user" u where u.id = m.user_id and u.email = $1`, [ME])
}

// The Verlauf with some of the detail around it.
async function around(page: Page, section: Locator, path: string) {
  await section.scrollIntoViewIfNeeded()
  const box = (await section.boundingBox())!
  const size = page.viewportSize()!
  const x = Math.max(0, box.x - 20)
  await page.screenshot({ path, clip: { x, y: Math.max(0, box.y - 16), width: Math.min(size.width - x, box.width + 40), height: box.height + 40 } })
}

async function settle(page: Page, ms = 1500) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(ms)
}

test('set up the Board', async ({ page, browser }) => {
  const other = await newTab(browser)
  await signIn(other, OTHER, { name: 'Mira' })
  await other.context().close()
  await signIn(page, ME, { name: 'Kim' })
  await resetBoard(page)
  await seedBoard(page)
  await gotoHydrated(page, '/')
  await expect(page.getByRole('link', { name: 'Cremige Pilzpasta' })).toBeVisible()
  boardPath = new URL(page.url()).pathname
})

for (const theme of THEMES) {
  test(`cards, ${theme}`, async ({ page }) => {
    await signIn(page, ME, { name: 'Kim' })
    await page.emulateMedia({ colorScheme: theme })
    for (const variant of VARIANTS) {
      for (const [size, viewport] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
        await page.setViewportSize(viewport)
        await unseen()
        await gotoHydrated(page, at(boardPath, { card: variant }))
        await expect(page.getByRole('link', { name: 'Cremige Pilzpasta' })).toBeVisible()
        // Let the cards rise in and "Neu" pop.
        await settle(page, 2500)
        await page.screenshot({ path: `${OUT}/card-${variant}-${size}-${theme}.png` })
      }
    }
  })

  test(`Verlauf, ${theme}`, async ({ page }) => {
    await signIn(page, ME, { name: 'Kim' })
    await page.emulateMedia({ colorScheme: theme })
    await page.setViewportSize(PHONE)
    await gotoHydrated(page, boardPath)
    const href = await page.getByRole('link', { name: 'Cremige Pilzpasta' }).getAttribute('href')
    for (const variant of VARIANTS) {
      for (const [size, viewport] of [['phone', { width: 360, height: 2600 }], ['desktop', { width: 1280, height: 2600 }]] as const) {
        await page.setViewportSize(viewport)
        await gotoHydrated(page, at(href!, { verlauf: variant }))
        const verlauf = page.locator(`[data-p330-verlauf="${variant}"]`)
        await expect(verlauf).toBeVisible()
        await settle(page, 2500)
        await around(page, verlauf, `${OUT}/verlauf-${variant}-${size}-${theme}.png`)
      }
    }
    // A Dish never cooked: no Votes yet.
    const never = await page.goto(at(boardPath, {})).then(() => page.getByRole('link', { name: 'Shakshuka' }).getAttribute('href'))
    for (const variant of VARIANTS) {
      await page.setViewportSize({ width: 360, height: 2600 })
      await gotoHydrated(page, at(never!, { verlauf: variant }))
      const verlauf = page.locator(`[data-p330-verlauf="${variant}"]`)
      await expect(verlauf).toBeVisible()
      await settle(page, 2000)
      await around(page, verlauf, `${OUT}/verlauf-${variant}-never-${theme}.png`)
    }
  })

  test(`Gekocht toast, ${theme}`, async ({ page }) => {
    await signIn(page, ME, { name: 'Kim' })
    await page.emulateMedia({ colorScheme: theme })
    for (const variant of VARIANTS) {
      for (const [size, viewport] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
        await page.setViewportSize(viewport)
        await gotoHydrated(page, at(boardPath, { toast: variant, hold: '1' }))
        await page.getByRole('button', { name: 'Gekocht ✓: „Kimchi-Pfannkuchen“' }).click()
        const toast = page.locator(`[data-p330-toast="${variant}"]`)
        await expect(toast).toBeVisible()
        // The pill at the top and the confetti go first.
        await settle(page, 3500)
        await page.screenshot({ path: `${OUT}/toast-${variant}-${size}-${theme}.png` })
        await toast.getByRole('button', { name: 'Daumen hoch' }).click()
        await settle(page, 700)
        await page.screenshot({ path: `${OUT}/toast-${variant}-${size}-${theme}-voted.png` })
        await toast.getByRole('button', { name: 'Rückgängig' }).click()
        await expect(toast).toBeHidden()
        await expect(page.getByRole('button', { name: 'Gekocht ✓: „Kimchi-Pfannkuchen“' })).toBeVisible()
        await settle(page, 800)
      }
    }
  })
}
