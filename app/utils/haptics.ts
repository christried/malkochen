// The handoff's haptics, where the device can vibrate (not iOS Safari).
// REJECT: something was taken away, e.g. a Dish deleted.
export function hapticReject() {
  if ('vibrate' in navigator) navigator.vibrate([20, 40, 20])
}

// SEGMENT_TICK: a light tick as something snaps into place, e.g. a Column.
export function hapticTick() {
  if ('vibrate' in navigator) navigator.vibrate(8)
}
