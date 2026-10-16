import type { TourTarget } from '~/tour/tour'

// The elements a Tour target names (`data-tour="<name>"`, app/tour/tour.ts)
// that are laid out: on phones the Columns' tabs, on larger screens their
// titles, for instance.
export function tourTargetElements(target: TourTarget): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].filter(el => el.getClientRects().length > 0 && el.offsetWidth > 0)
}

// The box round all of them, in the window; null with none laid out.
export function tourTargetBox(target: TourTarget) {
  const boxes = tourTargetElements(target).map(el => el.getBoundingClientRect())
  if (!boxes.length) return null
  const left = Math.min(...boxes.map(b => b.left))
  const top = Math.min(...boxes.map(b => b.top))
  const right = Math.max(...boxes.map(b => b.right))
  const bottom = Math.max(...boxes.map(b => b.bottom))
  return { left, top, width: right - left, height: bottom - top }
}
