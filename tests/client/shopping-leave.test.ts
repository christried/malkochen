import { describe, expect, test } from 'vitest'
import { CLEAR_COLLAPSE_MS, CLEAR_FADE_MS, CLEAR_STEP_MS, leaveKind, leavePlan, REMOVE_COLLAPSE_MS, REMOVE_FADE_MS, SLOT_MS } from '../../app/utils/shopping-leave'

// How a line or a group leaves the Shopping List (#536, R15): the plan for
// each way, as delays and lengths. Pure, so it tests without a browser.

describe('the handoff\'s timings', () => {
  test('a slot closes or opens in 380ms, a desktop removal fades in 200ms and its slot closes at 180ms', () => {
    expect(SLOT_MS).toBe(380)
    expect(REMOVE_FADE_MS).toBe(200)
    expect(REMOVE_COLLAPSE_MS).toBe(180)
  })

  test('"Erledigte entfernen" fades 160ms, 30ms apart, and closes the slots 140ms after each fade starts', () => {
    expect(CLEAR_FADE_MS).toBe(160)
    expect(CLEAR_STEP_MS).toBe(30)
    expect(CLEAR_COLLAPSE_MS).toBe(140)
  })
})

describe('leavePlan', () => {
  test('a desktop removal slides left and fades, then its slot closes', () => {
    expect(leavePlan('remove', 0, false)).toEqual({
      slide: true,
      fade: { delay: 0, duration: 200, easing: 'ease-in' },
      collapse: 180,
    })
  })

  test('a phone swipe has already left the row, so only the slot closes', () => {
    expect(leavePlan('swipe', 0, false)).toEqual({ slide: false, fade: null, collapse: 0 })
  })

  test('clearing the ticked lines fades each one 30ms after the last, and closes its slot 140ms after its own fade starts', () => {
    expect(leavePlan('clear', 0, false)).toEqual({
      slide: false,
      fade: { delay: 0, duration: 160, easing: 'fade' },
      collapse: 140,
    })
    expect(leavePlan('clear', 3, false)).toEqual({
      slide: false,
      fade: { delay: 90, duration: 160, easing: 'fade' },
      collapse: 230,
    })
  })

  test('reduced motion: every way is a 200ms fade, no slide, no collapse, no stagger', () => {
    for (const kind of ['swipe', 'remove', 'clear'] as const) {
      expect(leavePlan(kind, 4, true)).toEqual({
        slide: false,
        fade: { delay: 0, duration: 200, easing: 'fade' },
        collapse: null,
      })
    }
  })
})

describe('leaveKind', () => {
  test('a clear is a clear, whatever the row looks like', () => {
    expect(leaveKind({ querySelector: () => null } as unknown as Element, true)).toBe('clear')
  })

  test('a row a swipe has taken out of the way is a swipe; anything else is a removal', () => {
    const swiped = { querySelector: (selector: string) => selector === '.row-leaving' ? {} : null } as unknown as Element
    const plain = { querySelector: () => null } as unknown as Element
    expect(leaveKind(swiped, false)).toBe('swipe')
    expect(leaveKind(plain, false)).toBe('remove')
  })
})
