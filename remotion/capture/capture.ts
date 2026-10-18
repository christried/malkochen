import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { chromium, type Page } from '@playwright/test'
import { parse } from 'dotenv'
import pg from 'pg'
import { SPLASH_SEEN_KEY } from '../../shared/splash'
import { OUT_DIR, VARIANT } from '../scripts/brag-variant'
import { CUE, SHOT_ORDER, SHOTS, type ShotName, shotCue } from '../src/brag/timeline'
import { readProdBoard } from './prod-board'
import { Recorder } from './recorder'
import { type BoardContent, MADE_UP, MADE_UP_GRID, seed, servedFile, serveStockPhotos, SHARED, stockPhoto } from './seed'
import { PHONE, SERVER_FILE } from './settings'

// `pnpm exec tsx remotion/capture/capture.ts [--friends]` from the repo
// root, while serve.ts runs: seeds the Board of that version
// (scripts/brag-variant.ts), then records the real app on a phone, one
// session, into out/brag/<version>/shots/<shot>/ (frames and shot.json): a TikTok
// shared to malkochen and saved, dragged onto the second Column, a Column
// added in the Board settings, and cooked. Every tap lands on its beat of
// the video (CUE in src/brag/timeline.ts): a shot's frame 0 is its first
// beat, so its cues are frames within it (shotCue).

const SHARED_DISH = SHARED.suggestedTitle
// The Column added in the Board settings.
const NEW_COLUMN = 'Wochenende'

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false)
}

const tab = (page: Page, name: string) => page.locator('[data-tab-column-id]', { hasText: name })
const card = (page: Page, title: string) => page.locator('[data-dish-id]', { hasText: title })

type Shot = (page: Page, rec: Recorder, columns: string[]) => Promise<void>

// Android opens the installed app at /share?url=… (manifest share_target),
// as the video's app opens; then Add Dish, looked up, is saved.
const share: Shot = async (page, rec) => {
  await rec.tickTo(1)
  await page.evaluate((url) => {
    const nuxt = (window as unknown as { useNuxtApp: () => { $router: { push: (to: string) => unknown } } }).useNuxtApp()
    void nuxt.$router.push(`/share?${new URLSearchParams({ url })}`)
  }, SHARED.canonicalLink)
  await rec.tapAt(page.getByRole('dialog').locator('button[type="submit"]'), shotCue('share', CUE.save))
  await rec.tickTo(SHOTS.share.frames)
}

// Long-pressed and dragged onto the second Column's tab, then that tab.
const plan: Shot = async (page, rec, columns) => {
  const from = await rec.centre(card(page, SHARED_DISH))
  const to = await rec.centre(tab(page, columns[1]!))
  await rec.dragAt(from, to, 1, shotCue('plan', CUE.landed), { press: 12, rest: 5 })
  await rec.tapAt(tab(page, columns[1]!), shotCue('plan', CUE.dieseWoche))
  await rec.tickTo(SHOTS.plan.frames)
}

// The Board switcher, its Board settings, a new Column, and back.
const columns: Shot = async (page, rec) => {
  await rec.tapAt('header button, [aria-haspopup]', shotCue('columns', CUE.switcher))
  await rec.tapAt('a[href*="settings"]', shotCue('columns', CUE.gear))
  const typing = shotCue('columns', CUE.typing)
  await rec.tapAt('#settings-new-column', typing)
  await rec.typeAt(NEW_COLUMN, typing + 3)
  await rec.tapAt('form:has(#settings-new-column) button[type="submit"]', shotCue('columns', CUE.add))
  await rec.tapAt('main a[href^="/b/"], a[href^="/b/"]', shotCue('columns', CUE.back))
  await rec.tickTo(SHOTS.columns.frames)
}

const cook: Shot = async (page, rec, columns) => {
  await rec.tapAt(tab(page, columns[1]!), shotCue('cook', CUE.cookTab))
  await rec.tapAt(page.getByRole('button', { name: `Gekocht ✓: „${SHARED_DISH}“` }), shotCue('cook', CUE.cooked))
  await rec.tickTo(SHOTS.cook.frames)
}

const RECORD: Record<ShotName, Shot> = { share, plan, columns, cook }

// Production's connection string, read straight from the file Vercel pulls
// it into, so it is never printed, copied or kept anywhere else.
function prodDatabaseUrl() {
  const file = resolve(import.meta.dirname, '../../.env.production.local')
  const url = existsSync(file) ? parse(readFileSync(file)).DATABASE_URL : undefined
  if (!url) throw new Error('The friends version needs DATABASE_URL in .env.production.local')
  return url
}

// The opening grid of saved Dishes (Brag.tsx), into out/brag/<version>/:
// nine tiles, seven with a photo (grid/<n>.<ext>) and two drawn, as about
// one in five Dishes is. The made-up version's are MADE_UP_GRID; the real
// Board's are its first Dishes with an image, and two without one.
async function writeGrid(content: BoardContent) {
  const dishes = content.columns.flatMap(c => c.dishes)
  const photos = VARIANT === 'friends'
    ? dishes.filter(d => d.image).slice(0, 7).map(d => d.image!)
    : MADE_UP_GRID.filter(t => t.photo).map(t => stockPhoto(t.placeholder))
  const drawn = VARIANT === 'friends'
    ? [...dishes.filter(d => !d.image).map(d => d.placeholder), 'wok', 'cake'].slice(0, 2)
    : MADE_UP_GRID.filter(t => !t.photo).map(t => t.placeholder)
  if (photos.length < 7) throw new Error(`only ${photos.length} Dishes with an image for the opening grid`)
  await rm(join(OUT_DIR, 'grid'), { recursive: true, force: true })
  await mkdir(join(OUT_DIR, 'grid'), { recursive: true })
  const tiles = await Promise.all(photos.map(async (path, i) => {
    const file = `grid/${i}${extname(path)}`
    await copyFile(servedFile(path), join(OUT_DIR, file))
    return { photo: file }
  }))
  const grid = [...tiles.slice(0, 6), ...drawn.map(placeholder => ({ placeholder })), ...tiles.slice(6)]
  await writeFile(join(OUT_DIR, 'grid.json'), JSON.stringify(grid, null, 2))
  // The food video shared before the app is the shared Dish's photo.
  await copyFile(servedFile(SHARED.imageUrl), join(OUT_DIR, 'shared.jpg'))
}

async function main() {
  const { origin, databaseUrl } = JSON.parse(await readFile(SERVER_FILE, 'utf8')) as { origin: string, databaseUrl: string }
  const browser = await chromium.launch()
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: PHONE.width, height: PHONE.height },
    deviceScaleFactor: PHONE.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'light',
    locale: 'de-DE',
    serviceWorkers: 'block',
  })
  await context.addInitScript(key => sessionStorage.setItem(key, '1'), SPLASH_SEEN_KEY)
  await context.route('**/api/instagram-plays?*', route => route.fulfill({ json: { playsInPlace: null } }))
  await context.route('**/api/source-lookup?*', route => route.fulfill({ json: SHARED }))
  // Saving the shared Dish: its image, which the server can't copy (its
  // Image Ticket is made up), goes onto the Dish here instead, and the page
  // gets the answer as if the server had stored it.
  await context.route('**/api/boards/*/dishes', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const body = { ...route.request().postDataJSON() as object, imageUrl: null, imageTicket: null }
    const res = await route.fetch({ postData: JSON.stringify(body) })
    const added = await res.json() as { id: string }
    const client = new pg.Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query('update dish set image_url = $2 where id = $1', [added.id, SHARED.imageUrl])
    await client.end()
    await route.fulfill({ response: res, json: { ...added, imageUrl: SHARED.imageUrl } })
  })
  await serveStockPhotos()
  await mkdir(OUT_DIR, { recursive: true })
  // The friends version shows a real Board, read from production
  // (DATABASE_URL in the repo's .env.production.local; the Board and whose
  // view from BRAG_BOARD and BRAG_ME), with its Members' own Usernames, as
  // it is made for them; the public one MADE_UP.
  const content = VARIANT === 'friends'
    ? await readProdBoard(prodDatabaseUrl(), process.env.BRAG_BOARD ?? 'kochen lecker', { me: process.env.BRAG_ME, keepNames: true })
    : MADE_UP
  console.log(`Board: ${content.name} (${VARIANT}), ${content.columns.map(c => `${c.name} ${c.dishes.length}`).join(', ')}`)
  await writeGrid(content)
  const { path: boardPath, columns: columnNames } = await seed(context.request, origin, databaseUrl, content)

  const page = await context.newPage()
  await page.clock.install()
  await page.goto(boardPath, { waitUntil: 'load' })
  await waitForHydration(page)
  // The cards' rise-in, the fonts and the Placeholder Images done.
  await page.waitForTimeout(2000)
  await Recorder.freeze(page)
  for (const name of SHOT_ORDER) {
    const rec = new Recorder(page, join(OUT_DIR, 'shots', name))
    await rec.start()
    await RECORD[name](page, rec, columnNames)
    const { frames } = await rec.finish()
    console.log(`${name}: ${frames} frames`)
  }
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
