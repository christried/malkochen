import { describe, expect, test } from 'vitest'
import { coverOverflow, dragFocus, nudgeFocus } from '../../app/utils/image-focus'

// Shifting a Dish's image in the image dialog's preview: dragging it (or
// scrolling) moves the image under the frame, arrow keys move the focus
// point. Either way the focus point stays within the image, and only moves
// along the axis the frame crops.

// A portrait TikTok cover (9:16) in a frame of 200×100: scaled to 200×356,
// so 256px of it is cut off vertically and nothing horizontally.
const TIKTOK_IN_LANDSCAPE = coverOverflow({ width: 720, height: 1280 }, { width: 200, height: 100 })

describe('coverOverflow', () => {
  test('a portrait image in a landscape frame overflows it vertically', () => {
    expect(TIKTOK_IN_LANDSCAPE.x).toBe(0)
    expect(TIKTOK_IN_LANDSCAPE.y).toBeCloseTo(255.56, 1)
  })

  test('a landscape image in a portrait frame overflows it horizontally', () => {
    expect(coverOverflow({ width: 400, height: 300 }, { width: 86, height: 108 })).toEqual({ x: 58, y: 0 })
  })

  test('an image of the frame’s own shape doesn’t overflow it', () => {
    expect(coverOverflow({ width: 800, height: 600 }, { width: 400, height: 300 })).toEqual({ x: 0, y: 0 })
  })
})

describe('dragFocus', () => {
  const overflow = { x: 0, y: 200 }

  test('dragging the image up shows more of its lower part', () => {
    expect(dragFocus({ x: 50, y: 50 }, { dx: 0, dy: -50 }, overflow)).toEqual({ x: 50, y: 75 })
  })

  test('dragging it down shows more of its upper part', () => {
    expect(dragFocus({ x: 50, y: 50 }, { dx: 0, dy: 40 }, overflow)).toEqual({ x: 50, y: 30 })
  })

  test('it stops at the image’s edges', () => {
    expect(dragFocus({ x: 50, y: 90 }, { dx: 0, dy: -500 }, overflow)).toEqual({ x: 50, y: 100 })
    expect(dragFocus({ x: 50, y: 10 }, { dx: 0, dy: 500 }, overflow)).toEqual({ x: 50, y: 0 })
  })

  test('along an axis the frame doesn’t crop, nothing moves', () => {
    expect(dragFocus({ x: 50, y: 50 }, { dx: 80, dy: 0 }, overflow)).toEqual({ x: 50, y: 50 })
  })
})

describe('nudgeFocus', () => {
  test('arrow keys move the focus point the way they point', () => {
    expect(nudgeFocus({ x: 50, y: 50 }, 'ArrowDown')).toEqual({ x: 50, y: 55 })
    expect(nudgeFocus({ x: 50, y: 50 }, 'ArrowUp')).toEqual({ x: 50, y: 45 })
    expect(nudgeFocus({ x: 50, y: 50 }, 'ArrowRight')).toEqual({ x: 55, y: 50 })
    expect(nudgeFocus({ x: 50, y: 50 }, 'ArrowLeft')).toEqual({ x: 45, y: 50 })
  })

  test('it stays within the image', () => {
    expect(nudgeFocus({ x: 50, y: 98 }, 'ArrowDown')).toEqual({ x: 50, y: 100 })
    expect(nudgeFocus({ x: 2, y: 50 }, 'ArrowLeft')).toEqual({ x: 0, y: 50 })
  })

  test('other keys aren’t its', () => {
    expect(nudgeFocus({ x: 50, y: 50 }, 'Enter')).toBeNull()
  })
})
