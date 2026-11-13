import { expect, test } from 'vitest'
import { washDays } from '../../app/utils/week-wash'

// "Woche auf die Einkaufsliste" (#537, interaction "Put a week on"): the days
// that pulse once the week is on the list. Seam: the pure choice of days and
// their delays, from a week of days, which are past, and how many Planned
// Dishes each has.

const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
const past = (day: string) => day < '2026-11-11'
const planned = (counts: Record<string, number>) => (day: string) => counts[day] ?? 0

test('the days from today to Sunday with Planned Dishes pulse, the first at 120ms and 40ms apart', () => {
  const counts = { '2026-11-11': 1, '2026-11-12': 0, '2026-11-13': 2, '2026-11-15': 1 }
  expect(washDays(week, past, planned(counts))).toEqual([
    { day: '2026-11-11', at: 120 },
    { day: '2026-11-13', at: 160 },
    { day: '2026-11-15', at: 200 },
  ])
})

test('a past day with Planned Dishes does not pulse', () => {
  expect(washDays(week, past, planned({ '2026-11-09': 3, '2026-11-10': 1 }))).toEqual([])
})

test('a week with nothing planned on any day to Sunday does not pulse', () => {
  expect(washDays(week, () => false, planned({}))).toEqual([])
})

test('a later week pulses from its Monday to Sunday', () => {
  const later = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
  expect(washDays(later, () => false, planned({ '2026-11-16': 1, '2026-11-22': 1 }))).toEqual([
    { day: '2026-11-16', at: 120 },
    { day: '2026-11-22', at: 160 },
  ])
})
