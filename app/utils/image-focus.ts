import type { ImageFocus } from '../../shared/image-focus'

// Shifting a Dish's image in the image dialog's preview (shared/image-focus.ts).
// The image covers its frame, so it is cut off along one axis at most: that
// is the only way it can move. The focus point stays within the image.

export interface Size {
  width: number
  height: number
}

// How far, in px, an image of `natural` size overflows `frame` when it
// covers it (`object-fit: cover`), along each axis.
export function coverOverflow(natural: Size, frame: Size): ImageFocus {
  const scale = Math.max(frame.width / natural.width, frame.height / natural.height)
  return {
    x: Math.max(0, natural.width * scale - frame.width),
    y: Math.max(0, natural.height * scale - frame.height),
  }
}

// The focus point after the image was dragged by `dx`/`dy` px, from where it
// was at `from`. The image follows the pointer: dragging it up shows more of
// its lower part.
export function dragFocus(from: ImageFocus, { dx, dy }: { dx: number, dy: number }, overflow: ImageFocus): ImageFocus {
  return {
    x: overflow.x > 0 ? clamp(from.x - dx / overflow.x * 100) : from.x,
    y: overflow.y > 0 ? clamp(from.y - dy / overflow.y * 100) : from.y,
  }
}

// How far an arrow key moves the focus point, in percent.
const STEP = 5

// The focus point after an arrow key: it moves the way the key points.
// Null for any other key.
export function nudgeFocus(focus: ImageFocus, key: string): ImageFocus | null {
  switch (key) {
    case 'ArrowLeft': return { ...focus, x: clamp(focus.x - STEP) }
    case 'ArrowRight': return { ...focus, x: clamp(focus.x + STEP) }
    case 'ArrowUp': return { ...focus, y: clamp(focus.y - STEP) }
    case 'ArrowDown': return { ...focus, y: clamp(focus.y + STEP) }
    default: return null
  }
}

function clamp(percent: number): number {
  return Math.min(100, Math.max(0, percent))
}
