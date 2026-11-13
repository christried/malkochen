import { expect, test } from 'vitest'
import { heldOrder, LONG_PRESS_MS, SINK_HOLD_MS, swipeLeaves, swipeOffset, touchAxis, velocityPxPerS } from '../../app/utils/shopping-lines'

// The Shopping List's lines (#536, R15): where a ticked line waits before it
// sinks, and what a touch on a line decides (a long press, a swipe left, a
// scroll). Pure functions, so they test without a browser.

const ids = (items: { id: string }[]) => items.map(i => i.id)
const line = (id: string) => ({ id })

test('the hold and the long press are the handoff\'s timings', () => {
  expect(SINK_HOLD_MS).toBe(600)
  expect(LONG_PRESS_MS).toBe(450)
})

// ---- heldOrder: a ticked line waits where it was ----

test('with nothing held, the lines are in the module\'s order', () => {
  const items = [line('a'), line('b'), line('c')]
  expect(heldOrder(items, new Map())).toEqual(items)
})

test('a line ticked a moment ago stays at the place it had, not at the bottom the module gives it', () => {
  // Before the tick: a, b, c, d. Ticking b puts it last: a, c, d, b.
  const afterTick = [line('a'), line('c'), line('d'), line('b')]
  expect(ids(heldOrder(afterTick, new Map([['b', 1]])))).toEqual(['a', 'b', 'c', 'd'])
})

test('two lines ticked in the hold keep both places, in the order they had', () => {
  // Before: a, b, c, d. Ticking a and then b: c, d, a, b.
  const afterTicks = [line('c'), line('d'), line('a'), line('b')]
  expect(ids(heldOrder(afterTicks, new Map([['a', 0], ['b', 1]])))).toEqual(['a', 'b', 'c', 'd'])
})

test('an untick of a line that has sunk holds it at the bottom, then the module moves it back to its Recipe place', () => {
  // Recipe order a, b, c, d; b was ticked and sank: a, c, d, b. Unticking it,
  // the module puts it back at its Recipe place (a, b, c, d). Held at the
  // place it had on screen, it waits there first.
  const afterUntick = [line('a'), line('b'), line('c'), line('d')]
  expect(ids(heldOrder(afterUntick, new Map([['b', 3]])))).toEqual(['a', 'c', 'd', 'b'])
  expect(ids(heldOrder(afterUntick, new Map()))).toEqual(['a', 'b', 'c', 'd'])
})

test('a line ticked last of its group stays last', () => {
  const items = [line('a'), line('b'), line('c')]
  expect(ids(heldOrder(items, new Map([['c', 2]])))).toEqual(['a', 'b', 'c'])
})

test('a held line that has gone from the list is left out, not kept as a gap', () => {
  const items = [line('a'), line('c')]
  expect(ids(heldOrder(items, new Map([['gone', 1]])))).toEqual(['a', 'c'])
})

test('a held place past the end of the list goes to the end', () => {
  const items = [line('a'), line('b')]
  expect(ids(heldOrder([...items, line('x')], new Map([['x', 9]])))).toEqual(['a', 'b', 'x'])
})

test('heldOrder does not change the list it is given', () => {
  const items = [line('a'), line('c'), line('b')]
  heldOrder(items, new Map([['b', 1]]))
  expect(ids(items)).toEqual(['a', 'c', 'b'])
})

// ---- touchAxis: a finger that has moved 8px or more is a swipe, or left to the page ----

test('a finger that has not yet moved 8px has not chosen an axis', () => {
  expect(touchAxis(0, 0)).toBe('still')
  expect(touchAxis(-5, 5)).toBe('still')
})

test('a leftward move that is mainly sideways is a swipe', () => {
  expect(touchAxis(-12, 2)).toBe('swipe')
  expect(touchAxis(-10, 9)).toBe('swipe')
})

test('a move mainly up or down is a scroll, left to the page', () => {
  expect(touchAxis(2, 14)).toBe('scroll')
  expect(touchAxis(-4, 20)).toBe('scroll')
})

test('a move to the right is not a swipe (only leftward deletes)', () => {
  expect(touchAxis(14, 1)).toBe('scroll')
})

// ---- swipeOffset: the row follows the finger to the left, never past it ----

test('the row follows a leftward finger and stays where it is for a rightward one', () => {
  expect(swipeOffset(-60)).toBe(-60)
  expect(swipeOffset(25)).toBe(0)
  expect(swipeOffset(0)).toBe(0)
})

// ---- swipeLeaves: past 35% of the row, or a flick, deletes; a short swipe springs back ----

test('a swipe past 35% of the row width leaves', () => {
  expect(swipeLeaves(-120, 340, 0)).toBe(true)
  expect(swipeLeaves(-118, 340, 0)).toBe(false)
})

test('a fast flick leftwards leaves, even short', () => {
  expect(swipeLeaves(-40, 340, -700)).toBe(true)
})

test('a slow short swipe springs back', () => {
  expect(swipeLeaves(-60, 340, -200)).toBe(false)
})

test('a fast flick of a few pixels does not delete a line', () => {
  expect(swipeLeaves(-6, 340, -900)).toBe(false)
})

test('a row that has not moved left never leaves', () => {
  expect(swipeLeaves(0, 340, -900)).toBe(false)
  expect(swipeLeaves(30, 340, -900)).toBe(false)
})

// ---- velocityPxPerS: the speed of the last stretch of a drag, leftwards negative ----

test('velocity is pixels per second between two samples', () => {
  expect(velocityPxPerS({ x: 200, t: 1000 }, { x: 150, t: 1050 })).toBe(-1000)
  expect(velocityPxPerS({ x: 200, t: 1000 }, { x: 200, t: 1000 })).toBe(0)
})
