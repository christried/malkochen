// How far a sheet or bar must rise to sit on the on-screen keyboard (#536,
// #537). The keyboard takes the bottom of the visual viewport, and the layout
// viewport keeps its height: what is left under the visual viewport, from the
// layout viewport's bottom, is the keyboard. Used by the Shopping List's add
// bar and the Recipe editor's sheet.
export function keyboardInset(innerHeight: number, viewportHeight: number, viewportOffsetTop: number): number {
  return Math.max(0, Math.round(innerHeight - viewportHeight - viewportOffsetTop))
}
