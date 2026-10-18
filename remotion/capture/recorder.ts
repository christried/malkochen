import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CDPSession, Locator, Page } from '@playwright/test'
import { FPS } from './settings'

// Records the real app frame by frame, as a pure function of time: the page
// runs on Playwright's paused clock (timers, requestAnimationFrame,
// performance.now), and every CSS and Web Animation is paused and moved on
// by exactly one frame per step, so a frame shows what the app shows 1/30s
// after the one before, however long the screenshot took.

const FRAME_MS = 1000 / FPS

// A touch the video draws as a finger: where it is, at a frame.
export interface Touch {
  frame: number
  x: number
  y: number
  phase: 'down' | 'move' | 'up'
}

export interface Shot {
  frames: number
  touches: Touch[]
}

// In the page: pauses every animation it hasn't seen yet and moves every
// running one on by `ms`, finishing it at its end, so `finished` promises
// resolve and end events fire as they would. Animations on a scroll
// timeline are left alone: they never finish by time.
function step(ms: number) {
  const w = window as unknown as { __stepped?: WeakSet<Animation>, __done?: WeakSet<Animation> }
  const stepped = w.__stepped ??= new WeakSet()
  const done = w.__done ??= new WeakSet()
  for (const animation of document.getAnimations()) {
    if (animation.timeline !== document.timeline || done.has(animation)) continue
    if (!stepped.has(animation)) {
      stepped.add(animation)
      animation.pause()
      continue
    }
    if (animation.playState !== 'paused') animation.pause()
    const end = animation.effect?.getComputedTiming().endTime
    const next = Number(animation.currentTime ?? 0) + ms
    if (typeof end === 'number' && Number.isFinite(end) && next >= end) {
      done.add(animation)
      animation.finish()
    }
    else {
      animation.currentTime = next
    }
  }
}

export class Recorder {
  private frame = 0
  private touches: Touch[] = []
  private cdp?: CDPSession

  constructor(private page: Page, private dir: string) {}

  // Before the first frame: freezes time where it is.
  static async freeze(page: Page) {
    const now = await page.evaluate(() => Date.now())
    await page.clock.pauseAt(now + 50)
    await page.evaluate(step, 0)
  }

  // A new shot, on a page already frozen: its frames count from 0 again.
  async start() {
    await rm(this.dir, { recursive: true, force: true })
    await mkdir(this.dir, { recursive: true })
    this.cdp = await this.page.context().newCDPSession(this.page)
  }

  // One frame: time moves on by 1/30s, then the screen is captured.
  async tick(count = 1) {
    for (let i = 0; i < count; i++) {
      await this.page.clock.runFor(FRAME_MS)
      await this.page.evaluate(step, FRAME_MS)
      // A moment of real time for fetches that answered meanwhile to land
      // (the page's own timers are fake, so it can't wait itself).
      await this.settle(8)
      await this.page.screenshot({
        path: join(this.dir, `${String(this.frame).padStart(4, '0')}.jpeg`),
        type: 'jpeg',
        quality: 92,
        caret: 'hide',
      })
      this.frame++
    }
  }

  // Waits in real time, the page's clock standing still.
  async settle(ms = 120) {
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  private async touch(type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) {
    await this.cdp!.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 8, radiusY: 8, force: 1 }],
    })
    this.touches.push({ frame: this.frame, x, y, phase: type === 'touchStart' ? 'down' : type === 'touchEnd' ? 'up' : 'move' })
  }

  // A tap at the centre of `selector`'s first match, held for `hold` frames.
  async tap(target: string | Locator, hold = 3) {
    const { x, y } = await this.centre(target)
    await this.touch('touchStart', x, y)
    await this.tick(hold)
    await this.touch('touchEnd', x, y)
  }

  // Long-press `from`, then move to `to` over `frames` frames (eased), and
  // let go there.
  async drag(from: { x: number, y: number }, to: { x: number, y: number }, { press = 12, frames = 24, rest = 4 } = {}) {
    await this.touch('touchStart', from.x, from.y)
    await this.tick(press)
    for (let i = 1; i <= frames; i++) {
      const t = i / frames
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      await this.touch('touchMove', from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e)
      await this.tick()
    }
    await this.tick(rest)
    await this.touch('touchEnd', to.x, to.y)
  }

  async centre(target: string | Locator) {
    const box = await (typeof target === 'string' ? this.page.locator(target) : target).first().boundingBox()
    if (!box) throw new Error(`nothing to touch at ${String(target)}`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  async finish(): Promise<Shot> {
    const shot = { frames: this.frame, touches: this.touches }
    await writeFile(join(this.dir, 'shot.json'), JSON.stringify(shot, null, 2))
    await this.cdp?.detach()
    return shot
  }
}
