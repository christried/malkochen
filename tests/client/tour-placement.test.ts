import { expect, test } from 'vitest'
import { placeTour } from '../../app/utils/tour-placement'

// Where the Tour layer draws a step (handoff R12, topfbert/layers.json →
// tour.placement): the spotlight's hole, the bubble with its tail, and
// Topfbert (64×69) standing on the bubble's bottom edge, 10px over it, on
// the side away from the tail. All in px of the window.

const PHONE = { width: 360, height: 740 }
const DESKTOP = { width: 1280, height: 800 }
const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height })

test('the bubble is the screen less 24 and 54 wide, at most 320', () => {
  expect(placeTour({ viewport: PHONE, target: null, bubbleHeight: 120 }).bubble.width).toBe(282)
  expect(placeTour({ viewport: DESKTOP, target: null, bubbleHeight: 120 }).bubble.width).toBe(320)
})

test('the hole is the target and 6px around it', () => {
  const { hole } = placeTour({ viewport: PHONE, target: box(16, 20, 180, 44), bubbleHeight: 120 })

  expect(hole).toEqual(box(10, 14, 192, 56))
})

test('a target in the upper half gets the bubble below it, its tail pointing up, 8px from the ring', () => {
  const { bubble, tail } = placeTour({ viewport: PHONE, target: box(16, 20, 180, 44), bubbleHeight: 120 })

  // Hole bottom 70, ring 3, gap 8, the tail's 12px square at 45° (8.49 deep).
  expect(bubble.top).toBeCloseTo(70 + 3 + 8 + 6 * Math.SQRT2)
  expect(tail?.side).toBe('top')
})

test('a target in the lower half gets the bubble above it, its tail pointing down', () => {
  const { bubble, tail } = placeTour({ viewport: PHONE, target: box(270, 650, 66, 66), bubbleHeight: 120 })

  // Hole top 644.
  expect(bubble.top + 120).toBeCloseTo(644 - 3 - 8 - 6 * Math.SQRT2)
  expect(tail?.side).toBe('bottom')
})

test('the bubble flips to the other side when it doesn\'t fit where it would go', () => {
  // Its centre just in the lower half, but above it there's no room for
  // Topfbert standing on the bubble (69px); below, there is for the bubble.
  const { tail } = placeTour({ viewport: PHONE, target: box(16, 100, 328, 545), bubbleHeight: 50 })

  expect(tail?.side).toBe('top')
})

test('fitting neither side, the bubble stays on screen', () => {
  const { bubble } = placeTour({ viewport: PHONE, target: box(0, 30, 360, 680), bubbleHeight: 200 })

  expect(bubble.top).toBeGreaterThanOrEqual(12)
  expect(bubble.top + 200).toBeLessThanOrEqual(PHONE.height - 12)
})

test('a target on the right: Topfbert stands left of the bubble, as drawn, 10px over its edge', () => {
  const { bubble, topfbert } = placeTour({ viewport: PHONE, target: box(270, 650, 66, 66), bubbleHeight: 120 })

  expect(topfbert.mirrored).toBe(false)
  expect(topfbert.left).toBe(bubble.left - 54)
  expect(topfbert.top).toBe(bubble.top + 120 - 69)
})

test('a target on the left: Topfbert stands right of the bubble, mirrored to point left', () => {
  const { bubble, topfbert } = placeTour({ viewport: PHONE, target: box(16, 20, 180, 44), bubbleHeight: 120 })

  expect(topfbert.mirrored).toBe(true)
  expect(topfbert.left).toBe(bubble.left + bubble.width - 10)
})

test.each([
  ['top left', box(0, 0, 40, 40)],
  ['top right', box(320, 0, 40, 40)],
  ['bottom right', box(270, 650, 66, 66)],
  ['bottom left', box(10, 690, 40, 40)],
  ['across', box(0, 300, 360, 60)],
])('at 360px, a step for a target %s is fully on screen, Topfbert too', (_, target) => {
  const { bubble, topfbert } = placeTour({ viewport: PHONE, target, bubbleHeight: 150 })

  for (const [left, top, width, height] of [[bubble.left, bubble.top, bubble.width, 150], [topfbert.left, topfbert.top, 64, 69]] as const) {
    expect(left).toBeGreaterThanOrEqual(12)
    expect(left + width).toBeLessThanOrEqual(PHONE.width - 12)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + height).toBeLessThanOrEqual(PHONE.height)
  }
})

test('the tail sits under the target\'s centre, but no nearer the bubble\'s corners than 28px', () => {
  const middle = placeTour({ viewport: DESKTOP, target: box(500, 20, 200, 44), bubbleHeight: 120 })
  const corner = placeTour({ viewport: PHONE, target: box(0, 0, 40, 40), bubbleHeight: 120 })

  expect(middle.bubble.left + middle.tail!.x).toBe(600)
  expect(corner.tail!.x).toBe(28)
})

test('without a target, nothing is spotlit and there is no tail: the bubble sits 40px above the bottom, Topfbert left as drawn', () => {
  const { hole, tail, bubble, topfbert } = placeTour({ viewport: PHONE, target: null, bubbleHeight: 120 })

  expect(hole).toBeNull()
  expect(tail).toBeNull()
  expect(bubble.top + 120).toBe(PHONE.height - 40)
  expect(topfbert.mirrored).toBe(false)
  expect(topfbert.left).toBe(12)
})

test('a target partly off screen is spotlit where it shows', () => {
  const { hole } = placeTour({ viewport: DESKTOP, target: box(900, 120, 700, 40), bubbleHeight: 120 })

  expect(hole).toEqual(box(894, 114, 392, 52))
})

test.each([
  ['top right', 'top-right', 'top'],
  ['bottom right', 'bottom-right', 'bottom'],
] as const)('pointing towards the browser\'s menu %s: nothing spotlit, no tail, the bubble at that end, Topfbert left of it pointing right', (_, corner, end) => {
  const { hole, tail, bubble, topfbert } = placeTour({ viewport: PHONE, target: null, corner, bubbleHeight: 150 })

  expect(hole).toBeNull()
  expect(tail).toBeNull()
  if (end === 'top') expect(bubble.top).toBeLessThan(120)
  else expect(bubble.top + 150).toBeGreaterThan(PHONE.height - 120)
  expect(topfbert.mirrored).toBe(false)
  expect(topfbert.left).toBe(bubble.left - 54)
  for (const [left, top, width, height] of [[bubble.left, bubble.top, bubble.width, 150], [topfbert.left, topfbert.top, 64, 69]] as const) {
    expect(left).toBeGreaterThanOrEqual(12)
    expect(left + width).toBeLessThanOrEqual(PHONE.width - 12)
    expect(top).toBeGreaterThanOrEqual(0)
    expect(top + height).toBeLessThanOrEqual(PHONE.height)
  }
})
