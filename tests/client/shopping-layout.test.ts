import { describe, expect, test } from 'vitest'
import { keyboardInset, masonryColumns } from '../../app/utils/shopping-layout'

// The Shopping List's layout helpers (#536): where the phone add bar sits
// above the on-screen keyboard, and which desktop column each Dish group
// goes into.

describe('keyboardInset', () => {
  test('no keyboard: nothing to lift the bar by', () => {
    expect(keyboardInset(844, 844, 0)).toBe(0)
  })

  test('the keyboard takes the bottom of the visual viewport', () => {
    // 844 tall, the keyboard 300 high: the visible part is 544 from the top.
    expect(keyboardInset(844, 544, 0)).toBe(300)
  })

  test('a scrolled visual viewport counts its offset too', () => {
    expect(keyboardInset(844, 500, 44)).toBe(300)
  })

  test('never negative', () => {
    expect(keyboardInset(800, 820, 0)).toBe(0)
  })
})

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
