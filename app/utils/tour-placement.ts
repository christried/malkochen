// Where the Tour layer (TourLayer) draws a step, by the R12 handoff
// (topfbert/layers.json → tour.placement): the spotlight's hole around the
// target, the bubble beside it with a tail pointing at it, and Topfbert
// standing on the bubble's bottom edge, on the side away from the tail. All
// in px of the window.

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface TourPlacement {
  // The target and 6px around it; null for a step without one.
  hole: Box | null
  bubble: { left: number, top: number, width: number }
  // Its side facing the target, and how far along the bubble it sits.
  tail: { side: 'top' | 'bottom', x: number } | null
  // Mirrored, he points left (he's drawn pointing right).
  topfbert: { left: number, top: number, mirrored: boolean }
}

const MARGIN = 12
const MAX_BUBBLE = 320
export const TOPFBERT_WIDTH = 64
export const TOPFBERT_HEIGHT = 69
// He stands this far over the bubble's edge.
const OVERLAP = 10
const BESIDE = TOPFBERT_WIDTH - OVERLAP
export const HOLE_PADDING = 6
export const RING = 3
// The tail's tip from the ring, and how far the tail (a 12px square at 45°)
// stands out of the bubble.
const TAIL_GAP = 8
const TAIL_DEPTH = 6 * Math.SQRT2
const TAIL_CORNER = 28
// Without a target, the bubble's bottom above the window's (clear of the add
// button's top half).
const NO_TARGET_BOTTOM = 40

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

// `target`: the spotlit elements' box (null for none); `bubbleHeight`: the
// bubble as laid out at its width.
export function placeTour({ viewport, target, bubbleHeight }: { viewport: { width: number, height: number }, target: Box | null, bubbleHeight: number }): TourPlacement {
  const width = Math.min(MAX_BUBBLE, viewport.width - 2 * MARGIN - BESIDE)

  if (!target) {
    const groupLeft = Math.max(MARGIN, (viewport.width - width - BESIDE) / 2)
    const bubble = { left: groupLeft + BESIDE, top: viewport.height - NO_TARGET_BOTTOM - bubbleHeight, width }
    return { hole: null, bubble, tail: null, topfbert: { left: groupLeft, top: bubble.top + bubbleHeight - TOPFBERT_HEIGHT, mirrored: false } }
  }

  const hole = holeAround(target, viewport)
  const centreX = hole.left + hole.width / 2
  const centreY = hole.top + hole.height / 2

  // Above or below: towards the larger half, unless only the other fits.
  const offset = RING + TAIL_GAP + TAIL_DEPTH
  const aboveTop = hole.top - offset - bubbleHeight
  const belowTop = hole.top + hole.height + offset
  const fitsAbove = hole.top - offset - Math.max(bubbleHeight, TOPFBERT_HEIGHT) >= MARGIN
  const fitsBelow = belowTop + bubbleHeight <= viewport.height - MARGIN
  const preferAbove = centreY > viewport.height / 2
  const above = preferAbove ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove
  const top = clamp(above ? aboveTop : belowTop, MARGIN, viewport.height - MARGIN - bubbleHeight)

  // Centred under the target; Topfbert and bubble kept between the margins.
  const topfbertLeft = centreX >= viewport.width / 2
  const groupWidth = width + BESIDE
  const groupLeft = clamp(centreX - width / 2 - (topfbertLeft ? BESIDE : 0), MARGIN, viewport.width - MARGIN - groupWidth)
  const left = groupLeft + (topfbertLeft ? BESIDE : 0)

  return {
    hole,
    bubble: { left, top, width },
    tail: { side: above ? 'bottom' : 'top', x: clamp(centreX - left, TAIL_CORNER, width - TAIL_CORNER) },
    topfbert: {
      left: topfbertLeft ? groupLeft : left + width - OVERLAP,
      top: top + bubbleHeight - TOPFBERT_HEIGHT,
      mirrored: !topfbertLeft,
    },
  }
}

// The target where it shows in the window, and 6px around it.
function holeAround(target: Box, viewport: { width: number, height: number }): Box {
  const left = Math.max(0, target.left)
  const top = Math.max(0, target.top)
  const right = Math.min(viewport.width, target.left + target.width)
  const bottom = Math.min(viewport.height, target.top + target.height)
  return {
    left: left - HOLE_PADDING,
    top: top - HOLE_PADDING,
    width: Math.max(0, right - left) + 2 * HOLE_PADDING,
    height: Math.max(0, bottom - top) + 2 * HOLE_PADDING,
  }
}
