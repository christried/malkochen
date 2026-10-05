// A Dish image's focus point: the part of a Source image or own photo that a
// frame cropping it shows, in percent of the image's width (x) and height (y).
// It is used as the image's `object-position`, so it holds for every crop:
// the card's thumb, the detail's header, search results. A Member shifts it
// in the image dialog; a new image starts in the centre.
export interface ImageFocus {
  x: number
  y: number
}

export const FOCUS_CENTRE: Readonly<ImageFocus> = Object.freeze({ x: 50, y: 50 })

// The focus point as CSS `object-position`.
export function focusPosition(focus: ImageFocus): string {
  return `${focus.x}% ${focus.y}%`
}

// Whether two focus points are the same.
export function sameFocus(a: ImageFocus, b: ImageFocus): boolean {
  return a.x === b.x && a.y === b.y
}
