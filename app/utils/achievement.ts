// A Dish's achievement (handoff AchievementBadge): a level by how often it
// was cooked, and how far it is toward the next.
export type AchievementLevel = 'tried' | 'favourite' | 'regular' | 'classic'

// Each level from its number of Cookings on, lowest first.
const LEVELS: { level: AchievementLevel, from: number }[] = [
  { level: 'tried', from: 1 },
  { level: 'favourite', from: 3 },
  { level: 'regular', from: 5 },
  { level: 'classic', from: 10 },
]

// The Cooking that makes a Dish a Klassiker, the top level, and celebrates
// (milestone-10x).
export const MILESTONE_COOKINGS = LEVELS.at(-1)!.from

export interface Achievement {
  level: AchievementLevel
  // The level after it, null at the top: one pip per Cooking between the
  // two, `filled` of them done.
  next: { level: AchievementLevel, pips: number, filled: number } | null
}

// None until the Dish is cooked once.
export function achievementOf(cookings: number): Achievement | null {
  const at = LEVELS.findLastIndex(l => cookings >= l.from)
  if (at === -1) return null
  const { level, from } = LEVELS[at]!
  const next = LEVELS[at + 1]
  return { level, next: next ? { level: next.level, pips: next.from - from, filled: cookings - from } : null }
}
