import { expect, test } from 'vitest'
import { boardGradient, switcherGradient } from '../../app/utils/columns'

// Seam 4: the page behind the lanes, a gradient across the Column accents.
const stop = (accent: string) => `color-mix(in oklab, var(--color-${accent}) var(--wash-page), var(--color-bg))`

test('runs across the Column accents from left to right, starting over after the fifth', () => {
  expect(boardGradient(6)).toBe(`linear-gradient(to right, ${['butter', 'orchid', 'sage', 'carrot', 'sky', 'butter'].map(stop).join(', ')})`)
})

test('with a single Column (or none yet) it is that one accent, evenly', () => {
  expect(boardGradient(1)).toBe(`linear-gradient(to right, ${stop('butter')}, ${stop('butter')})`)
  expect(boardGradient(0)).toBe(`linear-gradient(to right, ${stop('butter')}, ${stop('butter')})`)
})

// The Board switcher's pill (#206) is filled with the same accents, fuller
// and washed into the surface colour, so it stands out from the page.
const fill = (accent: string) => `color-mix(in oklab, var(--color-${accent}) var(--wash-pill), var(--color-surface))`

test('the Board switcher’s fill runs across the same accents, washed into the surface', () => {
  expect(switcherGradient(3)).toBe(`linear-gradient(to right, ${['butter', 'orchid', 'sage'].map(fill).join(', ')})`)
  expect(switcherGradient(1)).toBe(`linear-gradient(to right, ${fill('butter')}, ${fill('butter')})`)
})
