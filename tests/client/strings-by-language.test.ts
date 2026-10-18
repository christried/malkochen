import { expect, test } from 'vitest'
import { de } from '../../app/strings/de'
import { en } from '../../app/strings/en'
import { it } from '../../app/strings/it'

// Counts, plurals and dates as each language writes them (#326), always in
// German time, so the server and the browser render the same day.

test.each([
  [de, 1, '1 Gericht gefunden'],
  [de, 3, '3 Gerichte gefunden'],
  [de, 1200, '1.200 Gerichte gefunden'],
  [en, 1, '1 dish found'],
  [en, 3, '3 dishes found'],
  [en, 1200, '1,200 dishes found'],
  [it, 0, '0 piatti trovati'],
  [it, 1, '1 piatto trovato'],
  [it, 3, '3 piatti trovati'],
  [it, 1200, '1200 piatti trovati'],
  [it, 12000, '12.000 piatti trovati'],
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

test('English names: "Ada", "Ada and Linus", "Ada, Linus and Grace", then "and 2 others"', () => {
  expect(en.push.added(['Ada'], 1, 'Lentil dal')).toBe('Ada added Lentil dal')
  expect(en.push.added(['Ada', 'Linus'], 2, 'Lentil dal')).toBe('Ada and Linus added 2 dishes')
  expect(en.push.added(['Ada', 'Linus', 'Grace'], 4, 'Lentil dal')).toBe('Ada, Linus and Grace added 4 dishes')
  expect(en.emailDigest.preheader(['Ada', 'Linus', 'Grace', 'Hedy'])).toBe('From Ada, Linus and 2 others. Take a look!')
})

test('the Email Digest\'s subject counts new dishes, in each language', () => {
  expect(de.emailDigest.subject(1, '🍪 Kochclub')).toBe('1 neues Gericht in 🍪 Kochclub')
  expect(de.emailDigest.subject(3, null)).toBe('3 neue Gerichte auf deinen Boards')
  expect(en.emailDigest.subject(1, '🍪 Kochclub')).toBe('1 new dish in 🍪 Kochclub')
  expect(en.emailDigest.subject(3, null)).toBe('3 new dishes on your boards')
})

test('Italian plurals: the participle and the verb follow the count (#327)', () => {
  expect(it.selection.count(1)).toBe('1 selezionato')
  expect(it.selection.count(2)).toBe('2 selezionati')
  expect(it.selection.movedToBoard(1, 'Club di cucina', 'Idee')).toBe('1 piatto ora è in Idee su Club di cucina')
  expect(it.selection.movedToBoard(4, 'Club di cucina', 'Idee')).toBe('4 piatti ora sono in Idee su Club di cucina')
  expect(it.settings.moveDishes(1, 'Idee')).toBe('1 piatto in “Idee”. Dove lo sposto?')
  expect(it.settings.moveDishes(3, 'Idee')).toBe('3 piatti in “Idee”. Dove li sposto?')
})

test('an Italian month and day, in German time', () => {
  expect(it.person.since(new Date('2026-02-28T23:30:00.000Z'))).toBe('qui da marzo 2026')
  expect(it.cooking.date(new Date('2024-09-03T10:00:00.000Z'))).toBe('3 set 2024')
})

test('Italian names: "Ada e Linus", then "e altri 2"', () => {
  expect(it.push.added(['Ada'], 1, 'Dal di lenticchie')).toBe('Ada ha aggiunto Dal di lenticchie')
  expect(it.push.added(['Ada', 'Linus'], 2, 'Dal di lenticchie')).toBe('Ada e Linus hanno aggiunto 2 piatti')
  expect(it.push.added(['Ada', 'Linus', 'Grace'], 4, 'Dal di lenticchie')).toBe('Ada, Linus e Grace hanno aggiunto 4 piatti')
  expect(it.push.body('Kochclub', ['Dal', 'Ramen'], 1)).toBe('Kochclub: Dal, Ramen e un altro')
  expect(it.push.body('Kochclub', ['Dal', 'Ramen'], 3)).toBe('Kochclub: Dal, Ramen e altri 3')
  expect(it.emailDigest.preheader(['Ada', 'Linus', 'Grace', 'Hedy'])).toBe('Da Ada, Linus e altri 2. Dai un’occhiata!')
  expect(it.emailDigest.subject(1, 'Kochclub')).toBe('1 nuovo piatto in Kochclub')
  expect(it.emailDigest.subject(3, null)).toBe('3 nuovi piatti sulle tue bacheche')
})
