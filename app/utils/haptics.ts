// The handoff's haptics, where the device can vibrate (not iOS Safari).
function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}

// REJECT: something was taken away, e.g. a Dish deleted.
export function hapticReject() {
  vibrate([20, 40, 20])
}

// SEGMENT_TICK: a light tick as something snaps into place, e.g. a Column.
export function hapticTick() {
  vibrate(8)
}

// LONG_PRESS: a card is picked up to drag.
export function hapticLongPress() {
  vibrate(15)
}

// GESTURE_THRESHOLD_ACTIVATE: a dragged card reaches a Column tab.
export function hapticActivate() {
  vibrate(12)
}

// CONFIRM: something landed, e.g. a Dish dropped into a Column tab.
export function hapticConfirm() {
  vibrate([10, 50, 20])
}

// The Gekocht celebration: CONFIRM, then two light ticks as the confetti
// bursts. One pattern, as each vibration cancels the one before.
export function hapticCelebrate() {
  vibrate([10, 50, 20, 90, 8, 60, 8])
}

// CLOCK_TICK: the lightest tick, e.g. a pebble landing on a Column tab.
export function hapticClockTick() {
  vibrate(5)
}
