// The handoff's haptics, where the device can vibrate (not iOS Safari).
// REJECT: something was taken away, e.g. a Dish deleted.
export function hapticReject() {
  if ('vibrate' in navigator) navigator.vibrate([20, 40, 20])
}

// SEGMENT_TICK: a light tick as something snaps into place, e.g. a Column.
export function hapticTick() {
  if ('vibrate' in navigator) navigator.vibrate(8)
}

// LONG_PRESS: a card is picked up to drag.
export function hapticLongPress() {
  if ('vibrate' in navigator) navigator.vibrate(15)
}

// GESTURE_THRESHOLD_ACTIVATE: a dragged card reaches a drop target.
export function hapticActivate() {
  if ('vibrate' in navigator) navigator.vibrate(12)
}

// CONFIRM: something landed, e.g. a Dish dropped into a Column tab.
export function hapticConfirm() {
  if ('vibrate' in navigator) navigator.vibrate([10, 50, 20])
}
