// The days of a Week Plan (CONTEXT.md: Week Plan): a week runs Monday to
// Sunday in every language, and a day is a calendar date in Europe/Berlin,
// 'YYYY-MM-DD', as the app dates everything (berlinDay). Plain date
// arithmetic on noon UTC, which is that day in German time too and is never
// moved by the clocks changing. Relative imports, as it runs in plain Node
// under test.

const date = (day: string) => new Date(`${day}T12:00:00Z`)
const dayOf = (at: Date) => at.toISOString().slice(0, 10)

// The day `count` days after `day` (before, if negative).
export function addDays(day: string, count: number): string {
  const at = date(day)
  at.setUTCDate(at.getUTCDate() + count)
  return dayOf(at)
}

export const addWeeks = (day: string, count: number) => addDays(day, count * 7)

// The Monday of the week `day` is in.
export function weekStart(day: string): string {
  const sinceMonday = (date(day).getUTCDay() + 6) % 7
  return addDays(day, -sinceMonday)
}

// The week `day` is in: its seven days, Monday first.
export function weekDays(day: string): string[] {
  const monday = weekStart(day)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

// Whether `day` has gone by: before `today`.
export const isPastDay = (day: string, today: string) => day < today

// Whether the week starting on `monday` is the one `today` is in.
export const isCurrentWeek = (monday: string, today: string) => weekStart(today) === monday
