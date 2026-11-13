// The day pulses of "Woche auf die Einkaufsliste" (#537, interaction "Put a
// week on"): once a week is on the Shopping List, each day from today (or the
// shown week's Monday) to Sunday that has Planned Dishes pulses a butter ring.
// The first starts 120ms after the answer, the next 40ms after the one before,
// so the eye goes down the week.
export const WASH_FROM_MS = 120
export const WASH_STEP_MS = 40

export function washDays(
  days: readonly string[],
  isPast: (day: string) => boolean,
  plannedOn: (day: string) => number,
): { day: string, at: number }[] {
  return days
    .filter(day => !isPast(day) && plannedOn(day) > 0)
    .map((day, i) => ({ day, at: WASH_FROM_MS + i * WASH_STEP_MS }))
}
