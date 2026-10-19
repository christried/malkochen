import { expect, test } from 'vitest'
import { daysLeft } from '../../app/utils/archive'

// How many days an Archived Dish has left in the Board's Archive (#336),
// from when the cleanup purges it (the server's `purgesAt`, 30 calendar
// days after it was archived): to the nearest whole day, so a change of
// daylight saving time in between doesn't make it 31, and never fewer than
// one while it is still listed (the daily cleanup takes it some hours after
// its time).

const NOW = new Date('2026-10-19T12:00:00Z')
const later = (hours: number) => new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString()

test('just archived, it has 30 days left, across a change of daylight saving time too', () => {
  expect(daysLeft(later(30 * 24), NOW)).toBe(30)
  expect(daysLeft(later(30 * 24 + 1), NOW)).toBe(30)
  expect(daysLeft(later(30 * 24 - 1), NOW)).toBe(30)
})

test('it counts down a day at a time', () => {
  expect(daysLeft(later(29 * 24), NOW)).toBe(29)
  expect(daysLeft(later(2 * 24 - 3), NOW)).toBe(2)
  expect(daysLeft(later(24), NOW)).toBe(1)
})

test('in its last hours, or past its time but not yet purged, it still has one', () => {
  expect(daysLeft(later(5), NOW)).toBe(1)
  expect(daysLeft(later(0), NOW)).toBe(1)
  expect(daysLeft(later(-5), NOW)).toBe(1)
})
