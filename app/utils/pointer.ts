// A mouse (or the like), as opposed to a finger: hover and mouse drag are
// gated on this, never on the screen's width (handoff README).
export const FINE_POINTER = '(pointer: fine)'

export function isFinePointer(): boolean {
  return matchMedia(FINE_POINTER).matches
}
