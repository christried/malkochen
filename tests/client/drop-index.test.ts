import { expect, test } from 'vitest'
import { DROP_HYSTERESIS, dropIndex } from '../../app/utils/drop-index'

// Seam 4: where a dragged card lands among a Column's other cards, from
// their middles (top to bottom) and the dragged card's middle. 128px cards,
// 12px apart: middles at 64, 204 and 344.
const MIDDLES = [64, 204, 344]

test('coming in from elsewhere, it goes past every card whose middle it is below', () => {
  expect(dropIndex(MIDDLES, 10, null)).toBe(0)
  expect(dropIndex(MIDDLES, 65, null)).toBe(1)
  expect(dropIndex(MIDDLES, 300, null)).toBe(2)
  expect(dropIndex(MIDDLES, 400, null)).toBe(3)
  expect(dropIndex([], 400, null)).toBe(0)
})

test('wiggling around a card\'s middle keeps the slot where it is', () => {
  // In slot 1, between the first and the second card.
  for (const middle of [204 - 10, 204, 204 + DROP_HYSTERESIS - 1, 64 - DROP_HYSTERESIS + 1, 64, 64 + 10]) {
    expect(dropIndex(MIDDLES, middle, 1)).toBe(1)
  }
})

test('going clearly past a card\'s middle moves the slot', () => {
  expect(dropIndex(MIDDLES, 204 + DROP_HYSTERESIS + 1, 1)).toBe(2)
  expect(dropIndex(MIDDLES, 64 - DROP_HYSTERESIS - 1, 1)).toBe(0)
})

test('once moved, it takes as much to come back', () => {
  const moved = dropIndex(MIDDLES, 204 + DROP_HYSTERESIS + 1, 1)
  expect(dropIndex(MIDDLES, 204, moved)).toBe(2)
  expect(dropIndex(MIDDLES, 204 - DROP_HYSTERESIS - 1, moved)).toBe(1)
})

test('a fast pointer jumps several slots at once', () => {
  expect(dropIndex(MIDDLES, 500, 0)).toBe(3)
  expect(dropIndex(MIDDLES, 0, 3)).toBe(0)
})
