import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { backgroundsBehind, countPeakPlaying, emptyColumnStill, loopStill, neverCookedClip, playing } from './clips'
import { gotoHydrated } from './hydration'
import { landingBoardId, removeStoredImages, resetBoard, seedDish, setColumns, storedImage } from './seed'
import { stubSourceLookup } from './source-lookup-stub'
import { EMPTY_COLUMN_ILLUSTRATIONS, emptyColumnIllustration } from '../../app/utils/empty-column'

// The state and system clips (PRD story 82; handoff REMOTION.md): empty
// Board, empty Column and search, the link lookup, a Dish never cooked,
// sign-in, Not unlocked, the invite landing, Offline (offline.spec.ts) and
// error each play their clip in the current theme. On the Board one empty
// state loops, whatever the cards play. Emmy's Board is used by this file
// only.
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const EMMY = ALLOWLISTED[19]
// An empty Column's loop: any of the three illustrations.
const EMPTY_COLUMN_LIGHT = new RegExp(`^/clips/(${EMPTY_COLUMN_ILLUSTRATIONS.join('|')})-light\\.svg$`)

test.afterAll(removeStoredImages)

test('an empty Board loops its clip in the current theme, and only that one', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  const peak = await countPeakPlaying(page)
  await signIn(page, EMMY)
  await resetBoard(page)
  await gotoHydrated(page, '/')

  await expect.poll(() => playing(page)).toEqual(['/clips/empty-board-dark.svg'])
  // Drawn on the lane itself: no box of its own around Topfbert.
  expect(await backgroundsBehind(page.locator('[data-empty="board"] [data-svg-loop]'))).toEqual([])
  // The other, empty Columns show their still.
  await expect(emptyColumnStill(column(page, 'Diese Woche'), 'dark')).toBeVisible()
  expect(await peak()).toBe(1)
})

test('empty Columns show the Board\'s own order of the three illustrations, and one of them loops', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  const peak = await countPeakPlaying(page, '/clips/empty-column')
  await signIn(page, EMMY)
  await setColumns(page, ['Ideen', 'Diese Woche', 'Später', 'Gekocht'])
  await seedDish(page, { title: 'Mit Foto', imageUrl: await storedImage(400, 500), sourceLink: TIKTOK, sourceKind: 'tiktok' })
  const boardId = await landingBoardId(page)
  const expected = [1, 2, 3].map(index => `/clips/${emptyColumnIllustration(boardId, index)}`)
  const shown = () => page.locator('[data-empty="column"] [data-svg-loop]')
    .evaluateAll(loops => loops.map(loop => loop.getAttribute('data-clip')))

  await gotoHydrated(page, '/')
  // Three empty Columns, three different illustrations: the Board's order.
  expect(await shown()).toEqual(expected)
  expect(new Set(expected).size).toBe(3)
  await expect.poll(() => playing(page, '/clips/empty-column')).toHaveLength(1)

  // A reload shows the same.
  await gotoHydrated(page, '/')
  expect(await shown()).toEqual(expected)
  await expect.poll(() => playing(page, '/clips/empty-column')).toHaveLength(1)
  expect(await peak()).toBe(1)
})

test('an empty Column\'s loop keeps playing while a Placeholder card is hovered or lifted', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  const peakPlaceholders = await countPeakPlaying(page, '/placeholders/')
  await signIn(page, EMMY)
  await resetBoard(page)
  await seedDish(page, { title: 'Mit Foto', imageUrl: await storedImage(400, 500), sourceLink: `${TIKTOK}?foto`, sourceKind: 'tiktok' })
  await seedDish(page, { title: 'Ohne Foto', placeholder: 'bowl', sourceLink: `${TIKTOK}?bowl`, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  // The bowl plays once on first view; an empty Column's loop goes on.
  await expect.poll(() => playing(page), { timeout: 10_000 }).toEqual([expect.stringMatching(EMPTY_COLUMN_LIGHT)])
  const loop = (await playing(page))[0]!

  // Hovered, the bowl loops beside it, and it keeps going.
  await page.getByRole('link', { name: 'Ohne Foto' }).hover()
  await expect.poll(async () => (await playing(page)).sort()).toEqual([loop, '/placeholders/bowl-light.svg'])
  await page.mouse.move(5, 5)
  await expect.poll(() => playing(page)).toEqual([loop])

  // Lifted, the same.
  const bowl = (await page.getByRole('link', { name: 'Ohne Foto' }).boundingBox())!
  await page.mouse.move(bowl.x + bowl.width / 2, bowl.y + bowl.height / 2)
  await page.mouse.down()
  await page.mouse.move(bowl.x + bowl.width / 2 + 20, bowl.y + bowl.height / 2, { steps: 4 })
  await expect(page.getByTestId('drag-card')).toBeVisible()
  await expect.poll(async () => (await playing(page)).sort()).toEqual([loop, '/placeholders/bowl-light.svg'])
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.getByTestId('drag-card')).toHaveCount(0)

  expect(await peakPlaceholders()).toBe(1)
})

test('an empty Column\'s loop starts from where its still rests', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  // On the first frame the loop plays, how far its moving layers are from
  // their pose in the still (the drawing as it is, its frame 0), and how far
  // they go over the next second: shifts in the drawing's units, turns and
  // squashes as the change in the transform's matrix. Whichever of the three
  // illustrations plays.
  await page.addInitScript(() => {
    type Moved = { shift: number, turn: number }
    const w = window as unknown as { loop: { first: Moved, furthest: Moved } | null }
    w.loop = null
    const away = (layer: HTMLElement): Moved => {
      const now = new DOMMatrix(getComputedStyle(layer).transform)
      const rest = new DOMMatrix(layer.style.transform || 'none')
      return {
        shift: Math.max(Math.abs(now.e - rest.e), Math.abs(now.f - rest.f)),
        turn: Math.max(...(['a', 'b', 'c', 'd'] as const).map(k => Math.abs(now[k] - rest[k]))),
      }
    }
    const most = (layers: HTMLElement[]): Moved => layers.map(away)
      .reduce((m, a) => ({ shift: Math.max(m.shift, a.shift), turn: Math.max(m.turn, a.turn) }), { shift: 0, turn: 0 })
    new MutationObserver(() => {
      const layers = [...document.querySelectorAll<HTMLElement>('[data-playing^="/clips/empty-column"] [data-loop-svg] [data-loop]')]
      if (!layers.length || w.loop) return
      requestAnimationFrame(() => {
        w.loop = { first: most(layers), furthest: { shift: 0, turn: 0 } }
        const started = performance.now()
        const sample = () => {
          const now = most(layers)
          w.loop!.furthest = { shift: Math.max(w.loop!.furthest.shift, now.shift), turn: Math.max(w.loop!.furthest.turn, now.turn) }
          if (performance.now() - started < 1200) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
    }).observe(document, { subtree: true, attributeFilter: ['data-playing'] })
  })
  await signIn(page, EMMY)
  await resetBoard(page)
  await seedDish(page, { title: 'Mit Foto', imageUrl: await storedImage(400, 500), sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  // Attached, not visible: once its loop is drawn over it, the still hides,
  // and the loop may already be up.
  await expect(emptyColumnStill(column(page, 'Diese Woche'))).toBeAttached()
  await expect.poll(() => playing(page)).toEqual([expect.stringMatching(EMPTY_COLUMN_LIGHT)])
  type Moved = { shift: number, turn: number }
  const loop = () => page.evaluate(() => (window as unknown as { loop: { first: Moved, furthest: Moved } | null }).loop)
  // It moves...
  await expect.poll(async () => {
    const furthest = (await loop())?.furthest
    return !!furthest && (furthest.shift > 10 || furthest.turn > 0.1)
  }).toBe(true)
  // ...from where it rested.
  const { first } = (await loop())!
  expect(first.shift).toBeLessThan(2)
  expect(first.turn).toBeLessThan(0.05)
})

test('a search that finds nothing loops its clip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, EMMY)
  await resetBoard(page)
  await seedDish(page, { title: 'Chana Masala', imageUrl: await storedImage(400, 500), sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gerichte suchen' }).click()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).fill('Pizza')

  const results = page.getByTestId('search-results')
  await expect(results.getByText('Nichts gefunden.')).toBeVisible()
  await expect.poll(() => playing(results)).toEqual(['/clips/search-empty-light.svg'])
  // Drawn on the page itself: no box of its own around it.
  expect(await backgroundsBehind(results.locator('[data-empty="search"] [data-svg-loop]'))).toEqual([])
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

  await expect.poll(() => playing(sheet)).toEqual(['/clips/lookup-stir.svg'])
  // Drawn on the panel's wash: no box of its own around Topfbert.
  expect(await backgroundsBehind(sheet.locator('[data-lookup="looking"] [data-svg-loop]'), '[data-lookup]')).toEqual([])
  answer()
  // Beside the form that opens, whose Placeholder picker loops its choice.
  await expect.poll(() => playing(sheet)).toContain('/clips/lookup-failed.svg')
  expect(await playing(sheet)).not.toContain('/clips/lookup-stir.svg')
  expect(await backgroundsBehind(sheet.locator('[data-lookup="failed"] [data-svg-loop]'), '[data-lookup]')).toEqual([])
})

test('a Dish never cooked loops its own scene in the Cooking History, until it is cooked', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await signIn(page, EMMY)
  await resetBoard(page)
  await seedDish(page, { title: 'Ofengemüse', imageUrl: await storedImage(400, 500), sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedDish(page, { title: 'Linsencurry', imageUrl: await storedImage(400, 500), sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  // Each Dish plays the scene its id picks, in the theme shown.
  async function openNeverCooked(title: string) {
    const card = page.getByRole('link', { name: title, exact: true })
    const clip = await neverCookedClip(card)
    await card.click()
    const detail = page.getByRole('dialog', { name: title })
    const history = detail.getByRole('region', { name: 'Gekocht' })
    await history.scrollIntoViewIfNeeded()
    await expect.poll(() => playing(history)).toEqual([`${clip}-dark.svg`])
    return { clip, detail, history }
  }
  const first = await openNeverCooked('Linsencurry')
  await first.detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(first.detail).toBeHidden()
  const { clip, history } = await openNeverCooked('Ofengemüse')

  // Cooked: no scene any more, nor its still.
  await history.getByRole('button', { name: 'Gekocht ✓' }).click()
  await expect(history.locator('[data-svg-loop]')).toHaveCount(0)
  await expect(loopStill(history, clip, 'dark')).toHaveCount(0)
})

test('the sign-in hero loops Topfbert, and every second tile of its turning ring', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await gotoHydrated(page, '/login')

  await expect.poll(async () => (await playing(page)).sort()).toEqual([
    '/clips/topfbert-wow-light.svg',
    '/placeholders/bowl-light.svg',
    '/placeholders/breakfast-light.svg',
    '/placeholders/pasta-light.svg',
    '/placeholders/wok-light.svg',
  ])
  // The ring turns.
  const ring = page.getByTestId('hero-ring')
  const turn = () => ring.evaluate(el => getComputedStyle(el).rotate)
  const before = await turn()
  await expect.poll(turn).not.toBe(before)
})

test('Not unlocked loops its clip, on its circle, with no box of its own', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await gotoHydrated(page, '/login?error=not_allowed')

  await expect.poll(() => playing(page)).toEqual(['/clips/not-unlocked.svg'])
  expect(await backgroundsBehind(page.locator('[data-svg-loop]'), 'main')).toEqual([])
  await expect(page.locator('main [data-blob]')).toHaveClass(/rounded-full/)
})

// What shows of the invite clip, sampled every frame: whether its drawing
// or the still covers it. Once something first does (the still may take a
// while to load), true as soon as neither does: a flash.
async function watchForFlash(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { clipFlashed: boolean }
    w.clipFlashed = false
    const seen = (el: Element) => el.checkVisibility({ visibilityProperty: true })
    const covered = (clip: Element) => {
      const drawing = clip.querySelector('[data-loop-svg]')
      if (drawing && seen(drawing)) return true
      return [...clip.querySelectorAll('img')].some(img => img.complete && img.naturalWidth > 0 && seen(img))
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

  const invited = await newTab(browser, { colorScheme: 'light' })
  const flashed = await watchForFlash(invited)
  // A slow loop, as on a slow connection: the hand-over shows the still
  // meanwhile.
  await invited.route('**/clips/invite-loop-*.svg', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 800))
    await route.continue()
  })
  await gotoHydrated(invited, link)

  await expect.poll(() => playing(invited), { intervals: [50] }).toEqual(['/clips/invite-intro-light.svg'])
  await expect.poll(() => playing(invited)).toEqual(['/clips/invite-loop-light.svg'])
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
  await expect.poll(() => playing(page)).toEqual(['/clips/error-light.svg'])
  expect(await page.locator('[data-loop-svg]').boundingBox()).toEqual(await loopStill(page, '/clips/error').boundingBox())
  expect(await backgroundsBehind(page.locator('[data-svg-loop]'), '.bg-bg')).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { layoutShift: number }).layoutShift)).toBe(0)
})
