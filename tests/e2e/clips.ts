import type { Locator, Page } from '@playwright/test'
import { neverCookedScene } from '../../app/utils/never-cooked'

// Motion clips in the browser tests: loops drawn in code (SvgLoop.vue), the
// only clips since the last videos went (#217).

// The clips playing inside `scope`, by the SVG they play; only those under
// `dir` (e.g. '/placeholders/') if given.
export function playing(scope: Page | Locator, dir = '/') {
  return scope.locator('[data-svg-loop][data-playing]').evaluateAll((clips, dir) => clips
    .map((clip) => {
      // A loop plays its file while its layers' animations run (and one that
      // stopped since it was found has no file any more).
      const running = clip.getAnimations({ subtree: true }).some(a => a.playState === 'running')
      return running ? clip.getAttribute('data-playing') : null
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
      const loops = [...document.querySelectorAll<HTMLElement>('[data-svg-loop][data-playing]')]
        .filter(loop => loop.dataset.playing?.startsWith(dir))
      w.peakPlaying = Math.max(w.peakPlaying, loops.length)
    }
    new MutationObserver(count).observe(document, { subtree: true, attributeFilter: ['data-playing'] })
  }, dir)
  return () => page.evaluate(() => (window as unknown as { peakPlaying: number }).peakPlaying)
}

// The backgrounds a drawn clip paints itself: those of the boxes it is sized
// in, up to `upTo` (its empty state, its celebration), and of everything it
// draws in (its still, the drawing's host and the drawing itself; what the
// drawing draws inside is tests/client's).
export function backgroundsBehind(clip: Locator, upTo = '[data-empty]') {
  return clip.evaluate((el, upTo) => {
    const boxes: Element[] = [...el.querySelectorAll(':scope div, :scope img, :scope > div > svg')]
    for (let box: Element | null = el; box && !box.matches(upTo); box = box.parentElement) boxes.push(box)
    return boxes.flatMap((box) => {
      const { backgroundColor, backgroundImage } = getComputedStyle(box)
      return backgroundColor !== 'rgba(0, 0, 0, 0)' || backgroundImage !== 'none'
        ? [`${box.tagName} ${box.getAttribute('class') ?? ''}: ${backgroundColor} ${backgroundImage}`]
        : []
    })
  }, upTo)
}

// The still of a loop drawn in code, `src` its drawing without the theme
// (e.g. '/clips/empty-column-knobi'), loaded. `theme` null: a drawing the
// same in both themes (`src` + '.svg').
export function loopStill(scope: Page | Locator, src: string, theme: 'light' | 'dark' | null = 'light') {
  return scope.locator(`img[src="${src}${theme ? `-${theme}` : ''}.svg"]`)
}

// The still of an empty Column in `scope` (e.g. one Column), whichever of the
// three illustrations its Board gives it (utils/empty-column.ts), loaded.
export function emptyColumnStill(scope: Page | Locator, theme: 'light' | 'dark' = 'light') {
  return scope.locator(`img[src^="/clips/empty-column"][src$="-${theme}.svg"]`)
}

// The "never cooked" scene of the Dish whose card link is `card`, its own by
// its id (utils/never-cooked.ts), as a loop's `src` (for loopStill).
export async function neverCookedClip(card: Locator) {
  const id = await card.getAttribute('id')
  if (!id?.startsWith('dish-')) throw new Error(`Not a Dish's card link: ${id}`)
  return `/clips/${neverCookedScene(id.slice('dish-'.length))}`
}

// What loads a clip: a loop's animated drawing.
const CLIP = '[data-loop-svg]'

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

// The animations running in `scope`, by name: none with reduced motion.
export function moving(scope: Locator) {
  return scope.evaluate(el => el.getAnimations({ subtree: true })
    .filter(animation => animation.playState === 'running')
    .map(animation => (animation as CSSAnimation).animationName ?? animation.id))
}
