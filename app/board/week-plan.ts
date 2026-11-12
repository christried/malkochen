// Relative imports, not `~~`: runs in plain Node under test, like the Board
// module.
import type { CookingView } from '../../server/utils/cookings'
import type { PlannedDishView } from '../../server/utils/week-plan'
import { berlinDay } from '../strings/intl'

// The Week Plan on the client (CONTEXT.md: Week Plan, Planned Dish; ADR
// 0014): the Board's Planned Dishes are one list, in order: by day, then
// place in the day. These are the small rules both the Board module and the
// Unsent Changes lay it out with, as the server does.

// Whether `day` is a calendar date, 'YYYY-MM-DD'.
export const isDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day)

// Where a Planned Dish lands among the day's others (`index`, else the end):
// at `index`, or at the end if there are fewer.
export function landingInDay(list: readonly PlannedDishView[], plannedId: string, day: string, index: number | undefined): number {
  const others = list.filter(p => p.day === day && p.id !== plannedId).length
  return index === undefined ? others : Math.max(0, Math.min(index, others))
}

// Puts the Planned Dish into the list at `index` among its day's others, or
// at the day's end, taking it from where it was in the list if it is in it.
// The others shift, as the server renumbers them. In place, so the Board
// keeps its objects.
export function putOnDay(list: PlannedDishView[], planned: PlannedDishView, index?: number) {
  takeOffPlan(list, planned.id)
  const others = list.filter(p => p.day === planned.day)
  const landing = landingInDay(list, planned.id, planned.day, index)
  let to: number
  if (landing < others.length) to = list.indexOf(others[landing]!)
  else if (others.length > 0) to = list.indexOf(others[others.length - 1]!) + 1
  else {
    const later = list.findIndex(p => p.day > planned.day)
    to = later === -1 ? list.length : later
  }
  list.splice(to, 0, planned)
}

// Takes the Planned Dish out of the list, found by its id; answers it.
export function takeOffPlan(list: PlannedDishView[], plannedId: string): PlannedDishView | undefined {
  const at = list.findIndex(p => p.id === plannedId)
  return at === -1 ? undefined : list.splice(at, 1)[0]
}

// Where a Planned Dish is in its day, to put it back there.
export function indexInDay(list: readonly PlannedDishView[], planned: PlannedDishView): number {
  return list.filter(p => p.day === planned.day).findIndex(p => p.id === planned.id)
}

// Whether the Dish was cooked on `day`: a Cooking of it dated that day in
// Europe/Berlin. This is all "cooked" is for a Planned Dish; nothing is stored.
export function cookedOn(cookings: readonly CookingView[], day: string): boolean {
  return cookings.some(c => berlinDay(c.cookedAt) === day)
}
