// A point on the screen, in viewport px: where a celebration bursts from,
// where a flight starts or lands.
export interface Point {
  x: number
  y: number
}

// The middle of a box on the screen.
export function centreOf(box: DOMRect): Point {
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}
