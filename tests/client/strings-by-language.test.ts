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

// Comments and Votes in the push and the Email Digest (#351, the user's
// picks in docs/reviews/comment-and-vote-wordings.md).
test('a push about one Comment or one Vote, in each language', () => {
  expect(de.push.commented('Ada', 'Linsen-Dal')).toBe('Ada hat Linsen-Dal kommentiert')
  expect(de.push.comment('🍪 Kochclub', 'Mit doppelt Ingwer!')).toBe('🍪 Kochclub: Mit doppelt Ingwer!')
  expect(de.push.voted('Ada', 'Linsen-Dal', true)).toBe('Ada fand Linsen-Dal gut 👍')
  expect(de.push.voted('Ada', 'Linsen-Dal', false)).toBe('Ada fand Linsen-Dal nicht so gut 👎')
  expect(en.push.commented('Ada', 'Lentil dal')).toBe('Ada commented on Lentil dal')
  expect(en.push.voted('Ada', 'Lentil dal', true)).toBe('Ada liked Lentil dal 👍')
  expect(en.push.voted('Ada', 'Lentil dal', false)).toBe('Ada didn’t like Lentil dal much 👎')
  expect(it.push.commented('Ada', 'Dal di lenticchie')).toBe('Ada ha commentato Dal di lenticchie')
  expect(it.push.voted('Ada', 'Dal di lenticchie', true)).toBe('Ada ha dato un pollice in su a Dal di lenticchie 👍')
  expect(it.push.voted('Ada', 'Dal di lenticchie', false)).toBe('Ada ha dato un pollice in giù a Dal di lenticchie 👎')
})

test('a push about several things on one Dish counts them', () => {
  expect(de.push.onDish(['Ada', 'Linus'], 'Linsen-Dal')).toBe('Ada und Linus zu Linsen-Dal')
  expect(de.push.counts('🍪 Kochclub', 1, 1)).toBe('🍪 Kochclub: 1 Kommentar, 1 Daumen')
  expect(de.push.counts('🍪 Kochclub', 3, 0)).toBe('🍪 Kochclub: 3 Kommentare')
  expect(de.push.counts('🍪 Kochclub', 0, 2)).toBe('🍪 Kochclub: 2 Daumen')
  expect(en.push.onDish(['Ada', 'Linus'], 'Lentil dal')).toBe('Ada and Linus on Lentil dal')
  expect(en.push.counts('Kochclub', 1, 3)).toBe('Kochclub: 1 comment, 3 thumbs')
  expect(it.push.onDish(['Ada', 'Linus'], 'Dal di lenticchie')).toBe('Ada e Linus su Dal di lenticchie')
  expect(it.push.counts('Kochclub', 2, 1)).toBe('Kochclub: 2 commenti, 1 pollice')
})

test('a push about Comments and Votes on several Dishes, alone and with new Dishes', () => {
  expect(de.push.wrote(['Ada', 'Linus'], 3)).toBe('Ada und Linus haben 3 Kommentare geschrieben')
  expect(de.push.wrote(['Ada'], 1)).toBe('Ada hat 1 Kommentar geschrieben')
  expect(de.push.gave(['Ada'], 2)).toBe('Ada hat 2 Daumen gegeben')
  expect(de.push.about('🍪 Kochclub', ['Linsen-Dal', 'Cremige Pilzpasta'], 0)).toBe('🍪 Kochclub: zu Linsen-Dal und Cremige Pilzpasta')
  expect(de.push.about('🍪 Kochclub', ['Linsen-Dal', 'Ramen'], 3)).toBe('🍪 Kochclub: zu Linsen-Dal, Ramen und 3 weiteren')
  expect(de.push.also('🍪 Kochclub: zu Linsen-Dal', 0, 1)).toBe('🍪 Kochclub: zu Linsen-Dal. Dazu 1 Daumen.')
  expect(de.push.also('🍪 Kochclub: Linsen-Dal, Ramen', 3, 1)).toBe('🍪 Kochclub: Linsen-Dal, Ramen. Dazu 3 Kommentare und 1 Daumen.')
  expect(en.push.wrote(['Ada', 'Linus'], 3)).toBe('Ada and Linus wrote 3 comments')
  expect(en.push.gave(['Ada'], 1)).toBe('Ada gave 1 thumb')
  expect(en.push.about('Kochclub', ['Lentil dal', 'Ramen'], 3)).toBe('Kochclub: on Lentil dal, Ramen and 3 more')
  expect(en.push.also('Kochclub: Lentil dal', 3, 1)).toBe('Kochclub: Lentil dal. Plus 3 comments and 1 thumb.')
  expect(it.push.wrote(['Ada', 'Linus'], 3)).toBe('Ada e Linus hanno scritto 3 commenti')
  expect(it.push.gave(['Ada'], 2)).toBe('Ada ha dato 2 pollici')
  expect(it.push.about('Kochclub', ['Dal', 'Ramen'], 0)).toBe('Kochclub: su Dal e Ramen')
  expect(it.push.about('Kochclub', ['Dal', 'Ramen'], 1)).toBe('Kochclub: su Dal, Ramen e un altro')
  expect(it.push.also('Kochclub: Dal', 1, 2)).toBe('Kochclub: Dal. In più 1 commento e 2 pollici.')
})

test('the Email Digest\'s Comments and Votes, in each language', () => {
  expect(de.emailDigest.history).toBe('Im Verlauf')
  expect(de.emailDigest.comment('Ada', 'Linsen-Dal', 'Super!')).toBe('Ada zu Linsen-Dal: „Super!“')
  expect(de.emailDigest.voted('Linus', 'Ramen', true)).toBe('Linus fand Ramen gut 👍')
  expect(de.emailDigest.talkSubject(3, 1, '🍪 Kochclub')).toBe('3 Kommentare und 1 Daumen in 🍪 Kochclub')
  expect(de.emailDigest.talkSubject(1, 0, null)).toBe('1 Kommentar auf deinen Boards')
  expect(en.emailDigest.history).toBe('In the history')
  expect(en.emailDigest.comment('Ada', 'Lentil dal', 'Great!')).toBe('Ada on Lentil dal: “Great!”')
  expect(en.emailDigest.talkSubject(0, 2, null)).toBe('2 thumbs on your boards')
  expect(it.emailDigest.history).toBe('Nella cronologia')
  expect(it.emailDigest.comment('Ada', 'Dal', 'Ottimo!')).toBe('Ada su Dal: “Ottimo!”')
  expect(it.emailDigest.talkSubject(3, 1, 'Kochclub')).toBe('3 commenti e 1 pollice in Kochclub')
})
