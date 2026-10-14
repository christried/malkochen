import { expect, test } from 'vitest'
import { de } from '../../app/strings/de'

// The user popover's lines (#213): since when someone is on malkochen, as
// German month and year in German time, and how many Dishes they added.

test.each([
  ['2026-03-14T10:00:00.000Z', 'dabei seit März 2026'],
  ['2025-12-01T12:00:00.000Z', 'dabei seit Dezember 2025'],
  // Already March in Berlin, still February in UTC.
  ['2026-02-28T23:30:00.000Z', 'dabei seit März 2026'],
  // Still December in Berlin's winter, past midnight only in UTC+2.
  ['2026-12-31T22:30:00.000Z', 'dabei seit Dezember 2026'],
])('an account made at %s is %s', (createdAt, label) => {
  expect(de.person.since(new Date(createdAt))).toBe(label)
})

test.each([
  [0, '0 Gerichte hinzugefügt'],
  [1, '1 Gericht hinzugefügt'],
  [23, '23 Gerichte hinzugefügt'],
])('%i Dishes added read „%s“', (count, label) => {
  expect(de.person.dishesAdded(count)).toBe(label)
})
