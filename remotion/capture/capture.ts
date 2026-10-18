import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Page } from '@playwright/test'
import { SPLASH_SEEN_KEY } from '../../shared/splash'
import { Recorder } from './recorder'
import { readProdBoard } from './prod-board'
import { MADE_UP, seed, SHARED } from './seed'
import { CUE, SHOT_ORDER, SHOTS, type ShotName, shotCue } from '../src/brag/timeline'
import { OUT_DIR, PHONE, SERVER_FILE } from './settings'

// `pnpm exec tsx remotion/capture/capture.ts` from the repo root, while
// serve.ts runs: seeds the Board, then records the real app on a phone, one
// session, into out/brag/shots/<shot>/ (frames and shot.json): a TikTok
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
  // A real Board, read from production, if .env says where (PROD_DATABASE_URL,
  // and the Board and whose it is, BRAG_BOARD and BRAG_ME); else MADE_UP.
  const prod = process.env.PROD_DATABASE_URL
  const content = prod ? await readProdBoard(prod, process.env.BRAG_BOARD ?? 'kochen lecker', process.env.BRAG_ME ?? 'Chris') : MADE_UP
  console.log(`Board: ${content.name} (${prod ? 'from production' : 'made up'}), ${content.columns.map(c => `${c.name} ${c.dishes.length}`).join(', ')}`)
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
