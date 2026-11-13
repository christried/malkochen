import { describe, expect, test } from 'vitest'
import { masonryColumns } from '../../app/utils/shopping-layout'

// The Shopping List's desktop layout (#536): which desktop column each Dish
// group goes into.

describe('masonryColumns', () => {
  test('the first group goes left, the next into the empty right column', () => {
    expect(masonryColumns([200, 100])).toEqual([0, 1])
  })

  test('each group goes into the currently shorter column', () => {
    // 200 left, 100 right: the third (150) goes right, making it 250, taller
    // than the left 200, so the fourth goes left.
    expect(masonryColumns([200, 100, 150, 300])).toEqual([0, 1, 1, 0])
  })

  test('a tie goes to the left', () => {
    expect(masonryColumns([100, 100, 100, 100])).toEqual([0, 1, 0, 1])
  })

  test('with a gap, each group takes its height plus the gap', () => {
    // 100 + 18 = 118 left; 90 + 18 = 108 right; right is shorter for the third.
    expect(masonryColumns([100, 90, 10], 18)).toEqual([0, 1, 1])
  })

  test('no groups, no columns', () => {
    expect(masonryColumns([])).toEqual([])
  })
})
