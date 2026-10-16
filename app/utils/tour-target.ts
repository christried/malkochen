import type { TourStep, TourTarget } from '~/tour/tour'

type Target = Pick<TourStep, 'target' | 'also' | 'dishId' | 'columnId'>

// The targets that are a particular Dish's (inside its place on the Board,
// `data-dish-id`) or a particular Column's (`data-tour-column-id`).
const OF_DISH: TourTarget[] = ['dish', 'dish-menu']
const OF_COLUMN: TourTarget[] = ['column', 'menu-column']

// The elements a Tour step's targets name (`data-tour="<name>"`,
// app/tour/tour.ts) that are laid out: on phones the Columns' tabs, on larger
// screens their titles, for instance; not a Column parked out of sight on
// phones.
export function tourTargetElements({ target, also, dishId, columnId }: Target): HTMLElement[] {
  return [target, also].flatMap((name) => {
    if (!name) return []
    let selector = `[data-tour="${name}"]`
    if (dishId && OF_DISH.includes(name)) selector = `[data-dish-id="${CSS.escape(dishId)}"] ${selector}`
    if (columnId && OF_COLUMN.includes(name)) selector += `[data-tour-column-id="${CSS.escape(columnId)}"]`
    return [...document.querySelectorAll<HTMLElement>(selector)]
  }).filter(el => el.getClientRects().length > 0 && el.offsetWidth > 0 && el.offsetHeight > 0)
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
