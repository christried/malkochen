// The Shopping List's lines (#536, R15): where a ticked line waits before it
// sinks to the bottom of its group, and what a touch on a line decides (a long
// press opens it, a swipe left deletes it, a scroll is left to the page). Pure,
// so the decisions test without a browser; ShoppingGroup and ShoppingItem
// keep the timers and the pointer events.

// How long a line ticked by this Member waits in place before it sinks
// (motion.sink-hold). Reduced motion keeps the hold.
export const SINK_HOLD_MS = 600

// A press this long, without moving, opens the line for changing (phones).
export const LONG_PRESS_MS = 450

// How far a finger has to move before it has chosen: a swipe, a scroll, or
// no longer a long press.
export const TOUCH_SLOP_PX = 8

// A swipe that has pulled the line this far of its width leaves (deletes it).
export const SWIPE_LEAVE_SHARE = 0.35
// A flick faster than this, leftwards, leaves too, if the line has moved at
// least FLICK_MIN_PX: a tiny jerk of the thumb deletes nothing.
export const SWIPE_FLICK_PX_PER_S = 600
export const SWIPE_FLICK_MIN_PX = 24

// The order a group's lines show in. `items` is the module's order (open
// lines in Recipe order, ticked ones at the bottom). `held` maps the id of a
// line this Member ticked in the last 600ms to the place it had: it stays
// there until the hold is over, and the rest keep the module's order around
// it. Held lines are put back in ascending place, so two ticks side by side
// keep both places.
export function heldOrder<T extends { id: string }>(items: readonly T[], held: ReadonlyMap<string, number>): T[] {
  const rest = items.filter(item => !held.has(item.id))
  const holding = items
    .filter(item => held.has(item.id))
    .sort((a, b) => held.get(a.id)! - held.get(b.id)!)
  for (const item of holding) {
    rest.splice(Math.min(held.get(item.id)!, rest.length), 0, item)
  }
  return rest
}

// What a touch that has moved (dx, dy) from where it went down has become:
// `still` until it has moved TOUCH_SLOP_PX, then a `swipe` when it goes
// mainly to the left, else a `scroll` (the page keeps the touch).
export type TouchAxis = 'still' | 'swipe' | 'scroll'

export function touchAxis(dx: number, dy: number): TouchAxis {
  if (Math.hypot(dx, dy) < TOUCH_SLOP_PX) return 'still'
  return dx < 0 && Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'scroll'
}

// The row follows the finger to the left; a move to the right leaves it where
// it is.
export function swipeOffset(dx: number): number {
  return Math.min(0, dx)
}

// Whether a swipe that let go at `offset` (px, zero or negative) of a row
// `width` wide, moving at `velocity` (px/s, leftwards negative), deletes the
// line.
export function swipeLeaves(offset: number, width: number, velocity: number): boolean {
  if (offset >= 0) return false
  if (-offset >= width * SWIPE_LEAVE_SHARE) return true
  return velocity <= -SWIPE_FLICK_PX_PER_S && -offset >= SWIPE_FLICK_MIN_PX
}

// The speed between two samples of a touch (`x` in px, `t` in ms).
export function velocityPxPerS(from: { x: number, t: number }, to: { x: number, t: number }): number {
  const dt = to.t - from.t
  return dt <= 0 ? 0 : ((to.x - from.x) / dt) * 1000
}
