import { afterEach, expect, test, vi } from 'vitest'
import { useExamplePrompt } from '../../app/composables/useExamplePrompt'
import { de } from '../../app/strings/de'

// A field's prompt with a made-up example in it, a new one each time it shows
// (a Dish's note, a new Board's name, a new Column's name).

afterEach(() => vi.restoreAllMocks())

// Math.random() answering the middle of each of `count` equal parts of 0..1
// in turn, so every example comes up once, in order.
function eachInTurn(count: number) {
  let next = 0
  vi.spyOn(Math, 'random').mockImplementation(() => (next++ % count + 0.5) / count)
}

test('a prompt starts on its first example, on the server as in the browser', () => {
  const column = useExamplePrompt(de.settings.newColumnExamples, de.settings.newColumnPrompt)

  expect(column.prompt.value).toBe('z. B. „Wochenende“')
})

test('a new Column’s name field goes through its ten examples', () => {
  const column = useExamplePrompt(de.settings.newColumnExamples, de.settings.newColumnPrompt)
  eachInTurn(10)

  const shown = Array.from({ length: 10 }, () => {
    column.pickAnother()
    return column.prompt.value
  })

  expect(shown).toEqual([
    'z. B. „Wochenende“',
    'z. B. „Meal Prep“',
    'z. B. „Für Gäste“',
    'z. B. „Schnell & einfach“',
    'z. B. „Sonntagsbrunch“',
    'z. B. „Nachtisch“',
    'z. B. „Grillsaison“',
    'z. B. „Lunchbox“',
    'z. B. „Feierabendküche“',
    'z. B. „Weihnachten“',
  ])
})

test('picking another can reach the last example and never leaves the list', () => {
  const note = useExamplePrompt(['eins', 'zwei', 'drei'], example => example)

  vi.spyOn(Math, 'random').mockReturnValue(0.999999)
  note.pickAnother()
  expect(note.prompt.value).toBe('drei')

  vi.spyOn(Math, 'random').mockReturnValue(0)
  note.pickAnother()
  expect(note.prompt.value).toBe('eins')
})
