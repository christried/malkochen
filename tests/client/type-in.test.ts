import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useTypeIn } from '../../app/composables/useTypeIn'

// Seam 4: the Suggested Title typing in (handoff "Title types in"). The text
// goes in, and the tests watch what the field shows as fake time passes.

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const PER_CHAR = 30

function setup(text: string) {
  const scope = effectScope()
  const source = ref(text)
  const typeIn = scope.run(() => useTypeIn(source))!
  return { source, typeIn, scope }
}

// The longest title the field takes.
const LONGEST = 'Ofengemüse mit Kichererbsen, Tahini-Zitronen-Dressing und Granatapfel, '.repeat(3).slice(0, 200)

test('a short title types in a character at a time', () => {
  const { typeIn } = setup('Linsen-Dal')

  typeIn.start(0, PER_CHAR)
  expect(typeIn.shown.value).toBe('')
  vi.advanceTimersByTime(PER_CHAR)
  expect(typeIn.shown.value).toBe('L')
  vi.advanceTimersByTime(PER_CHAR)
  expect(typeIn.shown.value).toBe('Li')
  vi.advanceTimersByTime(PER_CHAR * 8)
  expect(typeIn.shown.value).toBe('Linsen-Dal')
  expect(typeIn.typing.value).toBe(false)
})

test('a title just too long for 30ms a character still types one at a time', () => {
  // 29 characters: 870ms at 30ms each, so it is squeezed into 500ms,
  // which still leaves each character a step of its own (17ms).
  const text = 'Linsen-Dal mit Kokos und Reis'
  const { typeIn } = setup(text)

  typeIn.start(0, PER_CHAR)
  vi.advanceTimersByTime(18)
  expect(typeIn.shown.value).toBe('L')
  vi.advanceTimersByTime(17)
  expect(typeIn.shown.value).toBe('Li')
  vi.advanceTimersByTime(500)
  expect(typeIn.shown.value).toBe(text)
})

test('even the longest title finishes typing in well under a second', () => {
  const { typeIn } = setup(LONGEST)

  typeIn.start(0, PER_CHAR)
  vi.advanceTimersByTime(100)
  // Still typing, and showing a growing start of it.
  expect(typeIn.typing.value).toBe(true)
  expect(LONGEST.startsWith(typeIn.shown.value)).toBe(true)
  expect(typeIn.shown.value.length).toBeGreaterThan(0)

  vi.advanceTimersByTime(500)
  expect(typeIn.typing.value).toBe(false)
  expect(typeIn.shown.value).toBe(LONGEST)
})

test('a long title still waits for the delay before it starts', () => {
  const { typeIn } = setup(LONGEST)

  typeIn.start(1200, PER_CHAR)
  vi.advanceTimersByTime(1199)
  expect(typeIn.shown.value).toBe('')
  vi.advanceTimersByTime(1 + 600)
  expect(typeIn.shown.value).toBe(LONGEST)
})

test('with reduced motion (no time per character) all of it shows at once', () => {
  const { typeIn } = setup(LONGEST)

  typeIn.start(1200, 0)

  expect(typeIn.typing.value).toBe(false)
  expect(typeIn.shown.value).toBe(LONGEST)
})

test('typing into the field while it types in shows all of it', () => {
  const { source, typeIn } = setup(LONGEST)

  typeIn.start(0, PER_CHAR)
  vi.advanceTimersByTime(100)
  typeIn.shown.value = `${LONGEST}!`

  expect(source.value).toBe(`${LONGEST}!`)
  expect(typeIn.typing.value).toBe(false)
  expect(typeIn.shown.value).toBe(`${LONGEST}!`)
})
