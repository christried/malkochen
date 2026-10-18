import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Page } from '@playwright/test'
import { SPLASH_SEEN_KEY } from '../../shared/splash'
import { Recorder } from './recorder'
import { seed, SHARED } from './seed'
import { OUT_DIR, PHONE, SERVER_FILE } from './settings'

// `pnpm exec tsx remotion/capture/capture.ts` from the repo root, while
// serve.ts runs: seeds the made-up Board, then records the real app on a
// phone, one session, into out/brag/shots/<shot>/ (frames and shot.json):
// a TikTok shared to malkochen and saved, dragged into "Diese Woche", and
// cooked.

const SHARED_DISH = SHARED.suggestedTitle

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => (window as unknown as { useNuxtApp?: () => { isHydrating: boolean } }).useNuxtApp?.().isHydrating === false)
}

const tab = (page: Page, name: string) => page.locator('[data-tab-column-id]', { hasText: name })
const card = (page: Page, title: string) => page.locator('[data-dish-id]', { hasText: title })

// Android opens the installed app at /share?url=… (manifest share_target).
async function share(page: Page, rec: Recorder) {
  await rec.tick(8)
  await page.evaluate((url) => {
    const nuxt = (window as unknown as { useNuxtApp: () => { $router: { push: (to: string) => unknown } } }).useNuxtApp()
    void nuxt.$router.push(`/share?${new URLSearchParams({ url })}`)
  }, SHARED.canonicalLink)
  for (let i = 0; i < 60; i++) {
    await rec.tick()
    if (await page.getByRole('dialog').getByLabel('Titel').inputValue().catch(() => '') === SHARED_DISH) break
  }
  await rec.tick(30)
  await rec.tap(page.getByRole('dialog').locator('button[type="submit"]'))
  await rec.tick(45)
}

// Long-pressed and dragged onto the "Diese Woche" tab, then that tab.
async function plan(page: Page, rec: Recorder) {
  await rec.tick(6)
  const from = await rec.centre(card(page, SHARED_DISH))
  const to = await rec.centre(tab(page, 'Diese Woche'))
  await rec.drag(from, to, { press: 14, frames: 22, rest: 6 })
  await rec.tick(30)
  await rec.tap(tab(page, 'Diese Woche'))
  await rec.tick(30)
}

async function cook(page: Page, rec: Recorder) {
  await rec.tick(6)
  await rec.tap(page.getByRole('button', { name: `Gekocht ✓: „${SHARED_DISH}“` }))
  await rec.tick(75)
}

const SHOTS = { share, plan, cook }

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
  const boardPath = await seed(context.request, origin, databaseUrl)

  const page = await context.newPage()
  await page.clock.install()
  await page.goto(boardPath, { waitUntil: 'load' })
  await waitForHydration(page)
  // The cards' rise-in, the fonts and the Placeholder Images done.
  await page.waitForTimeout(2000)
  await Recorder.freeze(page)
  for (const [name, record] of Object.entries(SHOTS)) {
    const rec = new Recorder(page, join(OUT_DIR, 'shots', name))
    await rec.start()
    await record(page, rec)
    const { frames } = await rec.finish()
    console.log(`${name}: ${frames} frames`)
  }
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
