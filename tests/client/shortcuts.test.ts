import { expect, test } from 'vitest'
import { SHORTCUTS, shortcutFor } from '../../app/utils/shortcuts'

// Seam 4: which Board shortcut (#182) a key press is, given where focus is
// and whether a dialog or the side panel is open.
const free = { inField: false, modalOpen: false }
const press = (key: string, held: { ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean, shiftKey?: boolean } = {}) =>
  ({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...held })

test('each key is its shortcut', () => {
  expect(shortcutFor(press('n'), free)).toEqual({ action: 'addDish' })
  expect(shortcutFor(press('N', { shiftKey: true }), free)).toEqual({ action: 'addDish' })
  expect(shortcutFor(press('/'), free)).toEqual({ action: 'search' })
  expect(shortcutFor(press('Escape'), free)).toEqual({ action: 'close' })
  expect(shortcutFor(press(','), free)).toEqual({ action: 'boardSettings' })
  expect(shortcutFor(press('?', { shiftKey: true }), free)).toEqual({ action: 'help' })
})

test('1 to 9 switch to the 1st to 9th Board; 0 is nothing', () => {
  expect(shortcutFor(press('1'), free)).toEqual({ action: 'switchBoard', board: 0 })
  expect(shortcutFor(press('9'), free)).toEqual({ action: 'switchBoard', board: 8 })
  expect(shortcutFor(press('0'), free)).toBeNull()
})

test('other keys are nothing', () => {
  for (const key of ['a', 'Enter', ' ', 'ArrowDown', 'Tab', 'F1']) expect(shortcutFor(press(key), free)).toBeNull()
})

test('nothing with Ctrl, Alt or Cmd held, so the browser\'s shortcuts keep working', () => {
  for (const held of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
    for (const key of ['n', '/', ',', '1', '?', 'Escape']) expect(shortcutFor(press(key, held), free)).toBeNull()
  }
})

test('nothing while typing in a field, not even Escape (the field has its own)', () => {
  for (const key of ['n', '/', ',', '1', '?', 'Escape']) expect(shortcutFor(press(key), { inField: true, modalOpen: false })).toBeNull()
})

test('nothing while a dialog or the side panel is open: Escape closes that by itself', () => {
  // A native modal <dialog> closes on Escape; the Board must not also close
  // its search on the same press.
  const modal = { inField: false, modalOpen: true }
  for (const key of ['n', '/', ',', '1', '?', 'Escape']) expect(shortcutFor(press(key), modal)).toBeNull()
})

test('one list of shortcuts, in the order they are explained', () => {
  expect(SHORTCUTS.map(s => [s.keys, s.action])).toEqual([
    [['N'], 'addDish'],
    [['/'], 'search'],
    [['Esc'], 'close'],
    [[','], 'boardSettings'],
    [['1', '9'], 'switchBoard'],
    [['?'], 'help'],
  ])
})
