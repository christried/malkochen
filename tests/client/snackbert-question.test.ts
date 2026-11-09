import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { ASK_AFTER_MS, BYE_MS, createSnackbertQuestion } from '../../app/snackbert/snackbert-question'

// The Snackbert Question (#425): when Snackbert's head comes up after a
// Cooking. The screen is faked: whether Snackbert is on, the Toast, what is
// open over the Board and the Tour are refs the tests change; a Dish is a
// plain reactive object with its Cooking History, and the Cooking the server
// recorded comes when the test says so.

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function setup({ on = true } = {}) {
  const snackbertOn = ref(on)
  const toast = ref(false)
  const waiting = ref(false)
  const touring = ref(false)
  const asked: string[] = []
  const question = createSnackbertQuestion({
    snackbertOn: async (dishId) => {
      asked.push(dishId)
      return snackbertOn.value
    },
    toastShowing: () => toast.value,
    waiting: () => waiting.value,
    touring: () => touring.value,
  })

  // "Gekocht ✓" on a Dish: the Cooking shows in its history at once, the
  // Gekocht toast shows, and the server's Cooking comes once `record` runs.
  function cook(title: string, { tourDish = false } = {}) {
    const dish = reactive({ id: `dish-${title}`, title, cookings: [] as { id: string, cookedAt: string }[] })
    const pending = { id: '', cookedAt: '2026-11-09T12:00:00.000Z' }
    dish.cookings.unshift(pending)
    toast.value = true
    let settle!: (cooking: { id: string, cookedAt: string } | null) => void
    const recorded = new Promise<{ id: string, cookedAt: string } | null>(resolve => (settle = resolve))
    question.cooked({ dish, recorded, tourDish })
    return {
      dish,
      async record(id = `cooking-${title}`) {
        // Filled in where it shows; undone, it stays out of the history.
        const shown = dish.cookings.find(c => c.id === '')
        if (shown) shown.id = id
        settle({ id, cookedAt: pending.cookedAt })
        await vi.advanceTimersByTimeAsync(0)
      },
      async fail() {
        dish.cookings.splice(0, 1)
        settle(null)
        await vi.advanceTimersByTimeAsync(0)
      },
      undo() {
        dish.cookings.splice(0, 1)
      },
    }
  }

  // The Gekocht toast goes, its countdown run out.
  async function toastGoes() {
    toast.value = false
    await vi.advanceTimersByTimeAsync(ASK_AFTER_MS)
  }

  return { question, cook, toastGoes, toast, waiting, touring, snackbertOn, asked }
}

test('he asks about the Dish once the Gekocht toast has gone, not before', async () => {
  const { question, cook, toastGoes } = setup()
  const pasta = cook('Pilzpasta')
  await pasta.record()

  await vi.advanceTimersByTimeAsync(10_000)
  expect(question.asking.value).toBeNull()

  await toastGoes()
  expect(question.asking.value).toMatchObject({ dishId: 'dish-Pilzpasta', dish: 'Pilzpasta', cookingId: 'cooking-Pilzpasta', cookedAt: '2026-11-09T12:00:00.000Z', said: 'ask' })
})

test('he waits for the server to record the Cooking, and never asks if it recorded none', async () => {
  const { question, cook, toastGoes } = setup()
  const pasta = cook('Pilzpasta')
  await toastGoes()
  expect(question.asking.value).toBeNull()
  await pasta.record()
  await vi.advanceTimersByTimeAsync(ASK_AFTER_MS)
  expect(question.asking.value).toMatchObject({ cookingId: 'cooking-Pilzpasta' })

  const { question: other, cook: cookOther, toastGoes: otherToastGoes } = setup()
  const curry = cookOther('Curry')
  await curry.fail()
  await otherToastGoes()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(other.asking.value).toBeNull()
})

test('while the toast is paused (a Klassiker celebrating over it) he waits, and asks once it has gone', async () => {
  const { question, cook, toastGoes, waiting } = setup()
  const pasta = cook('Pilzpasta')
  await pasta.record()
  // The celebration opens over the toast, which waits with it.
  waiting.value = true
  await vi.advanceTimersByTimeAsync(30_000)
  expect(question.asking.value).toBeNull()

  waiting.value = false
  await vi.advanceTimersByTimeAsync(10_000)
  expect(question.asking.value).toBeNull()

  await toastGoes()
  expect(question.asking.value).toMatchObject({ dish: 'Pilzpasta' })
})

test('he waits while a celebration, the Changelog Popup, a Notification Prompt or a sheet is open', async () => {
  const { question, cook, toastGoes, waiting } = setup()
  await cook('Pilzpasta').record()
  waiting.value = true
  await toastGoes()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(question.asking.value).toBeNull()

  waiting.value = false
  await vi.advanceTimersByTimeAsync(ASK_AFTER_MS - 1)
  expect(question.asking.value).toBeNull()
  await vi.advanceTimersByTimeAsync(1)
  expect(question.asking.value).toMatchObject({ dish: 'Pilzpasta' })
})

test('something opening in the beat before he comes keeps him waiting', async () => {
  const { question, cook, toast, waiting } = setup()
  await cook('Pilzpasta').record()
  toast.value = false
  await vi.advanceTimersByTimeAsync(ASK_AFTER_MS / 2)
  waiting.value = true
  await vi.advanceTimersByTimeAsync(ASK_AFTER_MS)
  expect(question.asking.value).toBeNull()
})

test('never for a Cooking during the Tour, nor for the Tour\'s Dish', async () => {
  const { question, cook, toastGoes, touring } = setup()
  touring.value = true
  await cook('Pilzpasta').record()
  touring.value = false
  await toastGoes()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(question.asking.value).toBeNull()

  await cook('Tourgericht', { tourDish: true }).record()
  await toastGoes()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(question.asking.value).toBeNull()
})

test('a Tour starting before he comes keeps him away until it has ended', async () => {
  const { question, cook, toastGoes, touring } = setup()
  await cook('Pilzpasta').record()
  touring.value = true
  await toastGoes()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(question.asking.value).toBeNull()

  touring.value = false
  await vi.advanceTimersByTimeAsync(ASK_AFTER_MS)
  expect(question.asking.value).toMatchObject({ dish: 'Pilzpasta' })
})

test('a newer Cooking replaces the pending one', async () => {
  const { question, cook, toastGoes } = setup()
  await cook('Pilzpasta').record()
  await cook('Linsensuppe').record()
  await toastGoes()
  expect(question.asking.value).toMatchObject({ dish: 'Linsensuppe', cookingId: 'cooking-Linsensuppe' })
})

test('a newer Cooking sends away the Question showing, and he asks about the new one after its toast', async () => {
  const { question, cook, toastGoes } = setup()
  await cook('Pilzpasta').record()
  await toastGoes()
  expect(question.asking.value).toMatchObject({ dish: 'Pilzpasta' })

  const soup = cook('Linsensuppe')
  expect(question.asking.value).toBeNull()
  await soup.record()
  await toastGoes()
  expect(question.asking.value).toMatchObject({ dish: 'Linsensuppe' })
})

test('an undo drops its own Cooking, before or after the server recorded it', async () => {
  const { question, cook, toastGoes } = setup()
  const pasta = cook('Pilzpasta')
  await pasta.record()
  pasta.undo()
  await toastGoes()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(question.asking.value).toBeNull()

  const soup = cook('Linsensuppe')
  soup.undo()
  // The server records it, too late: the undo takes it back there.
  await soup.record()
  await toastGoes()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(question.asking.value).toBeNull()
})

test('an undo of an older Cooking doesn\'t drop the newer one', async () => {
  const { question, cook, toastGoes } = setup()
  const pasta = cook('Pilzpasta')
  await pasta.record()
  await cook('Linsensuppe').record()
  pasta.undo()
  await toastGoes()
  expect(question.asking.value).toMatchObject({ dish: 'Linsensuppe' })
})

test('never with Snackbert off', async () => {
  const { question, cook, toastGoes, asked } = setup({ on: false })
  await cook('Pilzpasta').record()
  await toastGoes()
  await vi.advanceTimersByTimeAsync(10_000)
  expect(asked).toEqual(['dish-Pilzpasta'])
  expect(question.asking.value).toBeNull()
})

test('"Ja" sends him away and answers the Cooking to report', async () => {
  const { question, cook, toastGoes } = setup()
  await cook('Pilzpasta').record()
  await toastGoes()

  expect(question.answer(true)).toMatchObject({ dishId: 'dish-Pilzpasta', dish: 'Pilzpasta', cookingId: 'cooking-Pilzpasta' })
  expect(question.asking.value).toBeNull()
  expect(question.answer(true)).toBeNull()
})

test('"Nein": his last word, then he goes, and doesn\'t come back for that Cooking', async () => {
  const { question, cook, toastGoes, waiting } = setup()
  await cook('Pilzpasta').record()
  await toastGoes()

  question.answer(false)
  expect(question.asking.value).toMatchObject({ dish: 'Pilzpasta', said: 'bye' })
  // "Ja" can't be pressed any more.
  expect(question.answer(true)).toBeNull()
  await vi.advanceTimersByTimeAsync(BYE_MS)
  expect(question.asking.value).toBeNull()

  waiting.value = true
  waiting.value = false
  await vi.advanceTimersByTimeAsync(10_000)
  expect(question.asking.value).toBeNull()
})
