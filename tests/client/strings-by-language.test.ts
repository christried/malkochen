import { expect, test } from 'vitest'
import { de } from '../../app/strings/de'
import { en } from '../../app/strings/en'

// Counts, plurals and dates as each language writes them (#326), always in
// German time, so the server and the browser render the same day.

test.each([
  [de, 1, '1 Gericht gefunden'],
  [de, 3, '3 Gerichte gefunden'],
  [de, 1200, '1.200 Gerichte gefunden'],
  [en, 1, '1 dish found'],
  [en, 3, '3 dishes found'],
  [en, 1200, '1,200 dishes found'],
])('a search finding %#: %s', (strings, count, label) => {
  expect(strings.search.found(count)).toBe(label)
})

test('a plural verb follows the count', () => {
  expect(de.selection.movedToBoard(1, 'Kochclub', 'Ideen')).toBe('1 Gericht ist jetzt in Kochclub · Ideen')
  expect(de.selection.moveFailed(2)).toBe('2 Gerichte ließen sich nicht verschieben. Versuch es gleich noch mal.')
  expect(en.selection.movedToBoard(1, 'Cooking club', 'Ideas')).toBe('1 dish is now in Ideas on Cooking club')
  expect(en.selection.movedToBoard(4, 'Cooking club', 'Ideas')).toBe('4 dishes are now in Ideas on Cooking club')
})

test('an English month and year, in German time', () => {
  expect(en.person.since(new Date('2026-03-14T10:00:00.000Z'))).toBe('here since March 2026')
  // Already March in Berlin, still February in UTC.
  expect(en.person.since(new Date('2026-02-28T23:30:00.000Z'))).toBe('here since March 2026')
})

test('a day of an earlier year carries its year, in each language', () => {
  const day = new Date('2024-09-03T10:00:00.000Z')
  expect(de.cooking.date(day)).toBe('3. Sept. 2024')
  expect(en.cooking.date(day)).toBe('3 Sept 2024')
})

test('English names: "Ada", "Ada and Linus", "Ada, Linus and Grace"', () => {
  expect(en.push.added(['Ada'], 1, 'Kochclub')).toBe('Ada added 1 dish to Kochclub')
  expect(en.push.added(['Ada', 'Linus', 'Grace'], 4, 'Kochclub')).toBe('Ada, Linus and Grace added 4 dishes to Kochclub')
})
