import { expect, test } from 'vitest'
import { backspaceOnEmpty, countShown, enterAt, moveLine, pastedLines, pasteInto, recipeToSave } from '../../app/utils/recipe-lines'
import { RECIPE_LIMITS } from '../../shared/recipe'

const { ingredients, steps } = RECIPE_LIMITS
const at = (start: number, end = start) => ({ start, end })

// Seam 4: the pure rules of editing a Recipe's lines (handoff "Paste lines",
// RecipeEditor's rules): what a paste makes of its text, where a paste, Enter
// and Backspace leave the lines and the caret, what saving keeps.

test('a paste is split on line breaks, trimmed, and its empty lines dropped', () => {
  expect(pastedLines('  200 g Mehl \r\n\r\n1 TL Salz\n   \n2 Eier')).toEqual(['200 g Mehl', '1 TL Salz', '2 Eier'])
})

test('a paste loses one leading bullet, dash or number with the spaces after it', () => {
  expect(pastedLines('• 200 g Mehl\n- 1 TL Salz\n* 2 Eier\n– 1 Prise Zucker')).toEqual(['200 g Mehl', '1 TL Salz', '2 Eier', '1 Prise Zucker'])
  expect(pastedLines('1. Teig kneten\n2) Teig gehen lassen\n12.   Backen')).toEqual(['Teig kneten', 'Teig gehen lassen', 'Backen'])
})

test('only one leading mark goes, and a number that is part of the text stays', () => {
  expect(pastedLines('- - 3 Eier\n2 Eier\n250 g Mehl\n1.5 l Milch')).toEqual(['- 3 Eier', '2 Eier', '250 g Mehl', '1.5 l Milch'])
})

test('a line that is nothing but a mark is dropped', () => {
  expect(pastedLines('•\n-\n1.\nMehl')).toEqual(['Mehl'])
})

test('pasted lines fill an empty line and the ones below it, the caret at the end of the last', () => {
  const pasted = pasteInto([''], 0, at(0), 'Mehl\nSalz\nEier', ingredients)
  expect(pasted).toMatchObject({ lines: ['Mehl', 'Salz', 'Eier'], inserted: 3, didNotFit: 0, focus: { index: 2, caret: 4 } })
})

test('a paste in the middle of a line keeps the text before the caret and moves the text after it to the last new line', () => {
  const pasted = pasteInto(['Salz', 'Pfeffer'], 0, at(2), 'x\ny\nz', ingredients)
  expect(pasted.lines).toEqual(['Sax', 'y', 'zlz', 'Pfeffer'])
  expect(pasted.focus).toEqual({ index: 2, caret: 1 })
  expect(pasted.inserted).toBe(3)
})

test('a paste replaces the selection', () => {
  expect(pasteInto(['Mehl und Salz'], 0, at(5, 9), 'a\nb', ingredients).lines).toEqual(['Mehl a', 'bSalz'])
})

test('a paste strips marks and drops blank lines', () => {
  expect(pasteInto([''], 0, at(0), '• 2 Eier\n\n- 1 Prise Salz\n', ingredients).lines).toEqual(['2 Eier', '1 Prise Salz'])
})

test('a paste cannot make more lines than the list holds, and says how many did not fit', () => {
  const full = ['a', 'b', '']
  const pasted = pasteInto(full, 2, at(0), 'c\nd\ne\nf', { lines: 4, characters: 200 })
  expect(pasted.lines).toEqual(['a', 'b', 'c', 'd'])
  expect(pasted).toMatchObject({ inserted: 2, didNotFit: 2, focus: { index: 3, caret: 1 } })
})

test('a list that is full takes the first piece in the line and nothing more', () => {
  const pasted = pasteInto(['a', ''], 1, at(0), 'b\nc', { lines: 2, characters: 200 })
  expect(pasted).toMatchObject({ lines: ['a', 'b'], inserted: 1, didNotFit: 1 })
})

test('a line is cut at the characters it may have, a long piece and the text after it alike', () => {
  const limits = { lines: 10, characters: 5 }
  expect(pasteInto([''], 0, at(0), 'abcdefgh\nxy', limits).lines).toEqual(['abcde', 'xy'])
  expect(pasteInto(['12'], 0, at(2), 'abcd\nxy', limits).lines).toEqual(['12abc', 'xy'])
  expect(pasteInto(['wxyz'], 0, at(1), 'a\nbcd', limits)).toMatchObject({ lines: ['wa', 'bcdxy'], focus: { index: 1, caret: 3 } })
})

test('the limits are the Recipe\'s own', () => {
  const long = 'x'.repeat(ingredients.characters + 30)
  expect(pasteInto([''], 0, at(0), `${long}\nb`, ingredients).lines[0]).toHaveLength(ingredients.characters)
  expect(pasteInto([''], 0, at(0), `${'y'.repeat(steps.characters + 1)}\nb`, steps).lines[0]).toHaveLength(steps.characters)
})

test('a paste of nothing but blank lines changes nothing', () => {
  const pasted = pasteInto(['Mehl'], 0, at(4), '\n \n', ingredients)
  expect(pasted).toMatchObject({ lines: ['Mehl'], inserted: 0, didNotFit: 0, focus: { index: 0, caret: 4 } })
})

test('Enter splits the line at the caret and moves to the new one', () => {
  expect(enterAt(['Salz und Pfeffer', 'Öl'], 0, at(4), ingredients)).toEqual({ lines: ['Salz', ' und Pfeffer', 'Öl'], focus: { index: 1, caret: 0 } })
  expect(enterAt(['Salz'], 0, at(4), ingredients)).toEqual({ lines: ['Salz', ''], focus: { index: 1, caret: 0 } })
})

test('Enter replaces a selection', () => {
  expect(enterAt(['Mehl und Salz'], 0, at(4, 9), ingredients)?.lines).toEqual(['Mehl', 'Salz'])
})

test('Enter in a list that is full does nothing', () => {
  expect(enterAt(['a', 'b'], 0, at(1), { lines: 2, characters: 200 })).toBeNull()
})

test('Backspace on an empty line removes it and goes to the end of the line above', () => {
  expect(backspaceOnEmpty(['Mehl', '', 'Salz'], 1)).toEqual({ lines: ['Mehl', 'Salz'], focus: { index: 0, caret: 4 } })
})

test('Backspace on an empty first line removes it and goes to the start of the next', () => {
  expect(backspaceOnEmpty(['', 'Salz'], 0)).toEqual({ lines: ['Salz'], focus: { index: 0, caret: 0 } })
})

test('Backspace never removes the only line, nor one with text', () => {
  expect(backspaceOnEmpty([''], 0)).toBeNull()
  expect(backspaceOnEmpty(['a', 'b'], 1)).toBeNull()
})

test('a line moves to its new place, the others closing up', () => {
  expect(moveLine(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  expect(moveLine(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
})

test('a move outside the list, or to where the line is, changes nothing', () => {
  const lines = ['a', 'b']
  expect(moveLine(lines, 0, 0)).toEqual(['a', 'b'])
  expect(moveLine(lines, 0, 2)).toEqual(['a', 'b'])
  expect(moveLine(lines, -1, 1)).toEqual(['a', 'b'])
})

test('saving trims the lines and drops the empty ones', () => {
  expect(recipeToSave({ ingredients: [' Mehl ', '', '  '], steps: ['', 'Backen  '] })).toEqual({ ingredients: ['Mehl'], steps: ['Backen'] })
})

test('saving two empty lists is no Recipe', () => {
  expect(recipeToSave({ ingredients: ['', ' '], steps: [] })).toBeNull()
})

test('saving one list alone keeps the Recipe', () => {
  expect(recipeToSave({ ingredients: [], steps: ['Backen'] })).toEqual({ ingredients: [], steps: ['Backen'] })
})

test('a line counts its characters from 180 of 200 and 900 of 1000', () => {
  expect(countShown('line', 'ingredients', 179)).toBe(false)
  expect(countShown('line', 'ingredients', 180)).toBe(true)
  expect(countShown('line', 'steps', 899)).toBe(false)
  expect(countShown('line', 'steps', 900)).toBe(true)
})

test('a list counts its lines from 50 of 60 and 35 of 40', () => {
  expect(countShown('list', 'ingredients', 49)).toBe(false)
  expect(countShown('list', 'ingredients', 50)).toBe(true)
  expect(countShown('list', 'steps', 34)).toBe(false)
  expect(countShown('list', 'steps', 35)).toBe(true)
})
