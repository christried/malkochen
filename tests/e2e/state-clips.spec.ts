import { expect, test, type Page } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { clipStill, countPeakPlaying, playing } from './clips'
import { gotoHydrated } from './hydration'
import { removeStoredImages, resetBoard, seedDish, storedImage } from './seed'
import { stubSourceLookup } from './source-lookup-stub'

// The state and system clips (PRD story 82; handoff REMOTION.md): empty
// Board, empty Column and search, the link lookup, a Dish never cooked,
// sign-in, Not unlocked, the invite landing, Offline (offline.spec.ts) and
// error each play their clip in the current theme. On the Board an empty
// state's loop is the Board's one loop. Emmy's Board is used by this file
// only.
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const EMMY = ALLOWLISTED[19]

test.afterAll(removeStoredImages)

test('an empty Board loops its clip in the current theme, and only that one', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  const peak = await countPeakPlaying(page)
  await signIn(page, EMMY)
  await resetBoard(page)
  await gotoHydrated(page, '/')

  await expect.poll(() => playing(page)).toEqual(['/clips/empty-board-dark.webm'])
  // The other, empty Columns show their still.
  await expect(clipStill(page, 'empty-column', 'dark').first()).toBeVisible()
  expect(await peak()).toBe(1)
})

test('an empty Column\'s loop is the Board\'s one loop, and gives way to a Placeholder\'s', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  const peak = await countPeakPlaying(page)
  await signIn(page, EMMY)
  await resetBoard(page)
  await seedDish(page, { title: 'Mit Foto', imageUrl: await storedImage(400, 500), sourceLink: `${TIKTOK}?foto`, sourceKind: 'tiktok' })
  await seedDish(page, { title: 'Ohne Foto', placeholder: 'curry', sourceLink: `${TIKTOK}?curry`, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  // The curry plays once on first view; then the Board's loop is an empty Column's.
  await expect.poll(() => playing(page), { timeout: 10_000 }).toEqual(['/clips/empty-column-light.webm'])

  await page.getByRole('link', { name: 'Ohne Foto' }).hover()
  await expect.poll(() => playing(page)).toEqual(['/placeholders/curry-light.webm'])
  await page.mouse.move(5, 5)
  await expect.poll(() => playing(page)).toEqual(['/clips/empty-column-light.webm'])

  expect(await peak()).toBe(1)
})

test('a search that finds nothing loops its clip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, EMMY)
  await resetBoard(page)
  await seedDish(page, { title: 'Shakshuka', imageUrl: await storedImage(400, 500), sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gerichte suchen' }).click()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).fill('Pizza')

  const results = page.getByTestId('search-results')
  await expect(results.getByText('Nichts gefunden.')).toBeVisible()
  await expect.poll(() => playing(results)).toEqual(['/clips/search-empty-light.webm'])
})

test('the link lookup loops Topfbert stirring, then his oops when it fails', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, EMMY)
  await resetBoard(page)
  let answer!: () => void
  await stubSourceLookup(page, 'fail', new Promise<void>(resolve => (answer = resolve)))
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await sheet.getByLabel('Link').fill(TIKTOK)

  await expect.poll(() => playing(sheet)).toEqual(['/clips/lookup-stir-light.webm'])
  answer()
  // Beside the form that opens, whose Placeholder picker loops its choice.
  await expect.poll(() => playing(sheet)).toContain('/clips/lookup-failed-light.webm')
  expect(await playing(sheet)).not.toContain('/clips/lookup-stir-light.webm')
})

test('a Dish never cooked loops its clip in the Cooking History, until it is cooked', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await signIn(page, EMMY)
  await resetBoard(page)
  await seedDish(page, { title: 'Ofengemüse', imageUrl: await storedImage(400, 500), sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  await page.getByRole('link', { name: 'Ofengemüse' }).click()
  const detail = page.getByRole('dialog', { name: 'Ofengemüse' })
  const history = detail.getByRole('region', { name: 'Gekocht' })
  await history.scrollIntoViewIfNeeded()
  await expect.poll(() => playing(history)).toEqual(['/clips/never-cooked-dark.webm'])

  await history.getByRole('button', { name: 'Gekocht ✓' }).click()
  await expect(history.locator('video')).toHaveCount(0)
  await expect(clipStill(history, 'never-cooked', 'dark')).toHaveCount(0)
})

test('the sign-in hero loops Topfbert, and every second tile of its turning ring', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await gotoHydrated(page, '/login')

  await expect.poll(async () => (await playing(page)).sort()).toEqual([
    '/clips/topfbert-wow-light.webm',
    '/placeholders/curry-light.webm',
    '/placeholders/pasta-light.webm',
    '/placeholders/tacos-light.webm',
    '/placeholders/wok-light.webm',
  ])
  // The ring turns.
  const ring = page.getByTestId('hero-ring')
  const turn = () => ring.evaluate(el => getComputedStyle(el).rotate)
  const before = await turn()
  await expect.poll(turn).not.toBe(before)
})

test('Not unlocked loops its clip', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await gotoHydrated(page, '/login?error=not_allowed')

  await expect.poll(() => playing(page)).toEqual(['/clips/not-unlocked-dark.webm'])
})

// What shows of the invite clip, sampled every frame: whether a video frame
// or the still covers it. Once something first does (the still may take a
// while to load), true as soon as neither does: a flash.
async function watchForFlash(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { clipFlashed: boolean }
    w.clipFlashed = false
    const covered = (clip: Element) => {
      const video = clip.querySelector('video')
      if (video && getComputedStyle(video).opacity === '1' && video.readyState >= 2) return true
      return [...clip.querySelectorAll('img')].some(img => img.complete && img.naturalWidth > 0 && img.checkVisibility())
    }
    let shown = false
    const sample = () => {
      const clip = document.querySelector('[data-invite-clip]')
      if (clip && covered(clip)) shown = true
      else if (shown) w.clipFlashed = true
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  return () => page.evaluate(() => (window as unknown as { clipFlashed: boolean }).clipFlashed)
}

test('the invite landing plays its intro, then hands over to the loop without a flash', async ({ page, browser }) => {
  await signIn(page, EMMY)
  const { id: boardId } = await (await page.request.post('/api/boards', { data: { name: 'Kochclub', emoji: '🍜' } })).json() as { id: string }
  await gotoHydrated(page, `/b/${boardId}/settings`)
  const link = await page.getByLabel('Einladungslink').inputValue()

  const invited = await (await browser.newContext({ baseURL: test.info().project.use.baseURL, colorScheme: 'light' })).newPage()
  const flashed = await watchForFlash(invited)
  // A slow still, as on a slow connection: the hand-over must not wait on it.
  await invited.route('**/clips/invite-loop-*.png', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 800))
    await route.continue()
  })
  await gotoHydrated(invited, link)

  await expect.poll(() => playing(invited), { intervals: [50] }).toEqual(['/clips/invite-intro-light.webm'])
  await expect.poll(() => playing(invited)).toEqual(['/clips/invite-loop-light.webm'])
  // The Board's emoji rides on the clip's pebble.
  await expect(invited.getByTestId('invite-emoji')).toHaveText('🍜')
  expect(await flashed()).toBe(false)
})

test('the error screen loops its clip, which takes its still\'s place without moving the layout', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  // Layout shifts within the clip (the headline shifts as its font loads).
  await page.addInitScript(() => {
    type Shift = { value: number, sources: { node: Node | null }[] }
    const w = window as unknown as { layoutShift: number }
    w.layoutShift = 0
    new PerformanceObserver(list => (list.getEntries() as unknown as Shift[]).forEach((shift) => {
      if (shift.sources.some(s => (s.node instanceof Element ? s.node : s.node?.parentElement)?.closest('[data-clip]'))) w.layoutShift += shift.value
    })).observe({ type: 'layout-shift', buffered: true })
  })
  await signIn(page, EMMY)
  await gotoHydrated(page, '/b/00000000-0000-4000-8000-000000000000')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Das gibt’s hier nicht.')
  await expect.poll(() => playing(page)).toEqual(['/clips/error-light.webm'])
  expect(await page.locator('video').boundingBox()).toEqual(await clipStill(page, 'error').boundingBox())
  expect(await page.evaluate(() => (window as unknown as { layoutShift: number }).layoutShift)).toBe(0)
})
