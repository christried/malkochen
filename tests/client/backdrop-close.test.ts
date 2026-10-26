import { expect, test } from 'vitest'
import { closesOnBackdrop } from '../../app/utils/backdrop-close'

// Seam 4: which press closes a sheet or dialog by its backdrop (#390). A
// press that started on the backdrop closes it; one that started inside and
// ended outside (a drag, selected text) doesn't; a sheet with typed text
// ignores outside clicks; ✕ and Escape never go through this rule.
test('a press that started on the backdrop closes an empty sheet', () => {
  expect(closesOnBackdrop({ startedOnBackdrop: true, typed: false })).toBe(true)
})

test('a press that started inside and ended outside does not close it', () => {
  expect(closesOnBackdrop({ startedOnBackdrop: false, typed: false })).toBe(false)
})

test('a sheet with typed text ignores the backdrop, even when the press started on it', () => {
  expect(closesOnBackdrop({ startedOnBackdrop: true, typed: true })).toBe(false)
})
