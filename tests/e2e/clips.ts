import type { Locator, Page } from '@playwright/test'
import { neverCookedScene } from '../../app/utils/never-cooked'

// Motion clips in the browser tests: videos (MotionClip.vue) and loops drawn
// in code (SvgLoop.vue).

// The clips playing inside `scope`, by the file they play (a video's, or a
// loop's SVG); only those under `dir` (e.g. '/placeholders/') if given.
export function playing(scope: Page | Locator, dir = '/') {
  return scope.locator('video, [data-svg-loop][data-playing]').evaluateAll((clips, dir) => clips
    .map((clip) => {
      // A loop plays its file while its layers' animations run (and one that
      // stopped since it was found has no file any more).
      if (!(clip instanceof HTMLVideoElement)) {
        const running = clip.getAnimations({ subtree: true }).some(a => a.playState === 'running')
        return running ? clip.getAttribute('data-playing') : null
      }
      return !clip.paused && !clip.ended && clip.currentTime > 0 ? new URL(clip.currentSrc).pathname : null
    })
    .filter((path): path is string => path !== null && path.startsWith(dir)), dir)
}

// Keeps count, in the page, of the most clips ever playing at once; only
// those under `dir` if given.
export async function countPeakPlaying(page: Page, dir = '/') {
  await page.addInitScript((dir) => {
    const w = window as unknown as { peakPlaying: number }
    w.peakPlaying = 0
    const count = () => {
      const videos = [...document.querySelectorAll('video')]
        .filter(v => !v.paused && new URL(v.currentSrc).pathname.startsWith(dir))
      const loops = [...document.querySelectorAll<HTMLElement>('[data-svg-loop][data-playing]')]
        .filter(loop => loop.dataset.playing?.startsWith(dir))
      w.peakPlaying = Math.max(w.peakPlaying, videos.length + loops.length)
    }
    document.addEventListener('playing', count, true)
    new MutationObserver(count).observe(document, { subtree: true, attributeFilter: ['data-playing'] })
  }, dir)
  return () => page.evaluate(() => (window as unknown as { peakPlaying: number }).peakPlaying)
}

// The still shown for clip `id` (its poster, /clips/<id>-<theme>.png), loaded.
export function clipStill(scope: Page | Locator, id: string, theme: 'light' | 'dark' = 'light') {
  return scope.locator(`img[src="/clips/${id}-${theme}.png"]`)
}

// The still of a loop drawn in code, `src` its drawing without the theme
// (e.g. '/clips/empty-column-butter'), loaded.
export function loopStill(scope: Page | Locator, src: string, theme: 'light' | 'dark' = 'light') {
  return scope.locator(`img[src="${src}-${theme}.svg"]`)
}

// The still of an empty Column in Columns of `accent`, whichever of the three
// illustrations its Board gives it (utils/empty-column.ts), loaded.
export function emptyColumnStill(scope: Page | Locator, accent: string, theme: 'light' | 'dark' = 'light') {
  return scope.locator(`img[src^="/clips/empty-column"][src$="-${accent}-${theme}.svg"]`)
}

// The "never cooked" scene of the Dish whose card link is `card`, its own by
// its id (utils/never-cooked.ts), as a loop's `src` (for loopStill).
export async function neverCookedClip(card: Locator) {
  const id = await card.getAttribute('id')
  if (!id?.startsWith('dish-')) throw new Error(`Not a Dish's card link: ${id}`)
  return `/clips/${neverCookedScene(id.slice('dish-'.length))}`
}

// What loads a clip: a video, or a loop's animated drawing.
const CLIP = 'video, [data-loop-svg]'

// Counts, in the page, every clip that ever comes into it.
export async function countClips(page: Page) {
  await page.addInitScript((clip) => {
    const w = window as unknown as { clips: number }
    w.clips = 0
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) w.clips += node.matches(clip) ? 1 : node.querySelectorAll(clip).length
        }
      }
    }).observe(document, { childList: true, subtree: true })
  }, CLIP)
  return () => page.evaluate(() => (window as unknown as { clips: number }).clips)
}
