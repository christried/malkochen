import type { Locator, Page } from '@playwright/test'

// Finding a Board's parts the way a user sees them.

export function column(page: Page, name: string) {
  return page.getByRole('region', { name })
}

// The titles of a Column's Dishes, top to bottom.
export function titles(page: Page, name: string) {
  return column(page, name).getByRole('heading', { level: 3 })
}

// A Column tab on phones, by its name and Dish count, e.g. "Ideen 2".
export function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Spalten' }).getByRole('button', { name })
}

// Once a card (or anything in it) has risen into its place on the Board.
export async function cardAtRest(inCard: Locator) {
  await inCard.evaluate(el => Promise.all((el.closest('li') ?? el).getAnimations().map(a => a.finished)))
}

// A finger swiping across the Board, as touch pointer events: a positive dx
// swipes right (back to the Column before), a negative one left. A slow
// swipe takes ~half a second, too slow to count as a flick. A fast one is
// sent from inside the page in ~12ms of real time, so it reads as a flick
// however slow the test runner is: one Playwright round-trip per event could
// take longer than the flick itself (useColumnSwipe wants > 0.5px/ms over
// the last 100ms). It still takes some time: no time at all is no speed.
export async function swipe(board: Locator, dx: number, { slow = false } = {}) {
  const box = (await board.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + 80
  const at = (clientX: number) => ({ pointerId: 7, pointerType: 'touch', isPrimary: true, clientX, clientY: y, bubbles: true })
  if (!slow) {
    await board.evaluate((el, { x, y, dx }) => {
      const send = (type: string, clientX: number) => el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX, clientY: y, bubbles: true }))
      const pause = (ms: number) => {
        const until = performance.now() + ms
        while (performance.now() < until) { /* a finger in motion */ }
      }
      send('pointerdown', x)
      for (let step = 1; step <= 6; step++) {
        pause(2)
        send('pointermove', x + dx * step / 6)
      }
      send('pointerup', x + dx)
    }, { x, y, dx })
    return
  }
  await board.dispatchEvent('pointerdown', at(x))
  for (let step = 1; step <= 6; step++) {
    await board.page().waitForTimeout(80)
    await board.dispatchEvent('pointermove', at(x + dx * step / 6))
  }
  await board.dispatchEvent('pointerup', at(x + dx))
}
