import { expect, test } from 'vitest'
import { confirmsDeletion } from '../../app/utils/delete-board'

// Deleting a Board (PRD story 71) waits until its name is typed: exactly,
// case and all. Moved down from members.spec.ts (#287): the API only checks
// who may delete.

test('the Board’s name, typed exactly, confirms', () => {
  expect(confirmsDeletion('Wegwerfboard', 'Wegwerfboard')).toBe(true)
})

test('spaces around it don’t count', () => {
  expect(confirmsDeletion('  Wegwerfboard ', 'Wegwerfboard')).toBe(true)
})

test('nothing typed, a part of it, or another case doesn’t', () => {
  for (const typed of ['', 'Wegwerf', 'wegwerfboard', 'WEGWERFBOARD', 'Wegwerfboards']) {
    expect(confirmsDeletion(typed, 'Wegwerfboard')).toBe(false)
  }
})
