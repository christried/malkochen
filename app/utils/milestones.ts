// Which Dishes this device has celebrated as Klassiker (milestone-10x), so
// the celebration plays once per Dish: not again when its 10th Cooking is
// undone and recorded again, or a Cooking deleted and the Dish cooked back
// up to 10. Kept in localStorage; where that is unavailable (a private
// window), for as long as the page stays open.
const KEY = 'malkochen:milestones'
const celebrated = new Set<string>()

// True the first time it is asked for a Dish, which counts as celebrated
// from then on.
export function claimMilestone(dishId: string): boolean {
  try {
    for (const id of JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]) celebrated.add(id)
  }
  catch {
    // Unreadable: what this page has celebrated still counts.
  }
  if (celebrated.has(dishId)) return false
  celebrated.add(dishId)
  try {
    localStorage.setItem(KEY, JSON.stringify([...celebrated]))
  }
  catch {
    // Not kept: remembered while the page stays open.
  }
  return true
}
