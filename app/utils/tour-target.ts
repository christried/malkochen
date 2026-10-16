import type { TourStep } from '~/tour/tour'

type Target = Pick<TourStep, 'target' | 'dishId'>

// The elements a Tour step's target names (`data-tour="<name>"`,
// app/tour/tour.ts) that are laid out: on phones the Columns' tabs, on larger
// screens their titles, for instance. A Dish's card is the one in the
// Dish's place on the Board (`data-dish-id`).
export function tourTargetElements({ target, dishId }: Target): HTMLElement[] {
  if (!target) return []
  const selector = dishId ? `[data-dish-id="${CSS.escape(dishId)}"] [data-tour="${target}"]` : `[data-tour="${target}"]`
  return [...document.querySelectorAll<HTMLElement>(selector)].filter(el => el.getClientRects().length > 0 && el.offsetWidth > 0)
}

// The box round all of them, in the window; null with none laid out.
export function tourTargetBox(elements: HTMLElement[]) {
  const boxes = elements.map(el => el.getBoundingClientRect())
  if (!boxes.length) return null
  const left = Math.min(...boxes.map(b => b.left))
  const top = Math.min(...boxes.map(b => b.top))
  const right = Math.max(...boxes.map(b => b.right))
  const bottom = Math.max(...boxes.map(b => b.bottom))
  return { left, top, width: right - left, height: bottom - top }
}
