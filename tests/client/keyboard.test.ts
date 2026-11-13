import { describe, expect, test } from 'vitest'
import { keyboardInset } from '../../app/utils/keyboard'

// The on-screen keyboard's height, as the Shopping List's add bar and the
// Recipe editor's sheet both lift above it (#536, #537).

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
