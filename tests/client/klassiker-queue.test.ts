import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { reactive } from 'vue'
import { createKlassikerQueue, type KlassikerDish } from '../../app/board/klassiker-queue'

// The Klassiker celebrations (#452): a Dish's 10th Cooking celebrates once
// it is recorded and a moment has passed; several, from one batch, one
// after the other; each Dish only ever once; and while any of them shows or
// waits its turn, the toast's "Rückgängig" waits too (#229). A Dish is a
// plain reactive object with its Cooking History; the moment is a timer.

const MOMENT = 1000

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function setup() {
  const claimed = new Set<string>()
  const queue = createKlassikerQueue<KlassikerDish & { title: string }>({
    moment: () => new Promise(resolve => setTimeout(resolve, MOMENT)),
    claim: (dishId) => {
      if (claimed.has(dishId)) return false
      claimed.add(dishId)
      return true
    },
  })
  afterEach(() => queue.stop())
  return { queue }
}

// A Dish just given its 10th Cooking, `cooking`.
function tenth(title: string) {
  const cooking = { id: `cooking-${title}` }
  const dish = reactive({ id: `dish-${title}`, title, cookings: [cooking, ...Array.from({ length: 9 }, (_, i) => ({ id: `${title}-${i}` }))] })
  return { dish, cooking }
}

const showing = (queue: ReturnType<typeof setup>['queue']) => queue.current.value?.dish.title ?? null

test('two Klassiker from one batch celebrate one after the other, a moment after it, with the toast paused throughout', async () => {
  const { queue } = setup()
  const soup = tenth('Soup')
  const stew = tenth('Stew')

  void queue.celebrate(Promise.resolve([soup, stew]))
  await vi.advanceTimersByTimeAsync(MOMENT - 1)
  expect(showing(queue)).toBe(null)
  await vi.advanceTimersByTimeAsync(1)
  expect(showing(queue)).toBe('Soup')
  expect(queue.toastPaused.value).toBe(true)

  queue.close()
  expect(showing(queue)).toBe(null)
  expect(queue.toastPaused.value).toBe(true)
  await vi.advanceTimersByTimeAsync(MOMENT)
  expect(showing(queue)).toBe('Stew')
  expect(queue.toastPaused.value).toBe(true)

  queue.close()
  await vi.advanceTimersByTimeAsync(MOMENT)
  expect(showing(queue)).toBe(null)
  expect(queue.toastPaused.value).toBe(false)
})

test('a Dish celebrates as a Klassiker only once', async () => {
  const { queue } = setup()
  const soup = tenth('Soup')

  void queue.celebrate(Promise.resolve([soup]))
  await vi.advanceTimersByTimeAsync(MOMENT)
  expect(showing(queue)).toBe('Soup')
  queue.close()

  // Its 10th Cooking undone and recorded again, in another batch.
  soup.dish.cookings[0] = { id: 'again' }
  void queue.celebrate(Promise.resolve([{ dish: soup.dish, cooking: { id: 'again' } }]))
  await vi.advanceTimersByTimeAsync(MOMENT * 2)
  expect(showing(queue)).toBe(null)
  expect(queue.toastPaused.value).toBe(false)
})

test('undoing the batch ends the Klassiker showing, and the next one never comes', async () => {
  const { queue } = setup()
  const soup = tenth('Soup')
  const stew = tenth('Stew')

  void queue.celebrate(Promise.resolve([soup, stew]))
  await vi.advanceTimersByTimeAsync(MOMENT)
  expect(showing(queue)).toBe('Soup')

  // "Rückgängig" in the toast over it takes both Cookings off.
  soup.dish.cookings.shift()
  stew.dish.cookings.shift()
  await vi.advanceTimersByTimeAsync(0)
  expect(showing(queue)).toBe(null)
  await vi.advanceTimersByTimeAsync(MOMENT * 2)
  expect(showing(queue)).toBe(null)
  expect(queue.toastPaused.value).toBe(false)

  // Never celebrated, Stew still can be.
  void queue.celebrate(Promise.resolve([tenth('Stew')]))
  await vi.advanceTimersByTimeAsync(MOMENT)
  expect(showing(queue)).toBe('Stew')
})

test('a Cooking that failed celebrates nothing', async () => {
  const { queue } = setup()

  void queue.celebrate(Promise.resolve([]))
  await vi.advanceTimersByTimeAsync(MOMENT)
  expect(showing(queue)).toBe(null)
  expect(queue.toastPaused.value).toBe(false)
})

test('the toast waits from the Cooking on, while its Klassiker is still being recorded', async () => {
  const { queue } = setup()
  let record!: (found: ReturnType<typeof tenth>[]) => void
  void queue.celebrate(new Promise(resolve => (record = resolve)))

  expect(queue.toastPaused.value).toBe(true)
  await vi.advanceTimersByTimeAsync(MOMENT * 5)
  expect(showing(queue)).toBe(null)
  expect(queue.toastPaused.value).toBe(true)

  // The server answers: it wasn't one after all (cooked to 10 before).
  record([])
  await vi.advanceTimersByTimeAsync(0)
  expect(queue.toastPaused.value).toBe(false)
})
