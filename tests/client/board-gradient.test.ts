import { expect, test } from 'vitest'
import { auraColours, boardColours, boardGradient } from '../../app/utils/columns'

// Seam 4: the page behind the lanes, a gradient across the Column accents.
const stop = (accent: string) => `color-mix(in oklab, var(--color-${accent}) var(--wash-page), var(--color-bg))`

test('runs across the Column accents from left to right, starting over after the fifth', () => {
  expect(boardGradient(6)).toBe(`linear-gradient(to right, ${['butter', 'orchid', 'sage', 'carrot', 'sky', 'butter'].map(stop).join(', ')})`)
})

test('with a single Column (or none yet) it is that one accent, evenly', () => {
  expect(boardGradient(1)).toBe(`linear-gradient(to right, ${stop('butter')}, ${stop('butter')})`)
  expect(boardGradient(0)).toBe(`linear-gradient(to right, ${stop('butter')}, ${stop('butter')})`)
})

// The aura on the Board switcher's pill and the add button (#285): one tail
// of light in the Board's Column accents, as many as it has Columns.
const accent = (name: string) => `var(--color-${name})`

test('the aura runs through the Board’s Column accents, starting over after the fifth', () => {
  expect(auraColours(3)).toBe(['butter', 'orchid', 'sage'].map(accent).join(', '))
  expect(auraColours(6)).toBe(['butter', 'orchid', 'sage', 'carrot', 'sky', 'butter'].map(accent).join(', '))
})

test('with a single Column (or none yet) the aura is that one accent', () => {
  expect(auraColours(1)).toBe(accent('butter'))
  expect(auraColours(0)).toBe(accent('butter'))
})

test('a Board hands down its page gradient and its aura colours', () => {
  expect(boardColours(2)).toEqual({ '--board-gradient': boardGradient(2), '--aura-colours': auraColours(2) })
})
