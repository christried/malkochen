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
  expect(en.push.title(['Ada'], 'Kochclub')).toBe('From Ada in Kochclub')
  expect(en.push.title(['Ada', 'Linus'], 'Kochclub')).toBe('From Ada and Linus in Kochclub')
  expect(en.push.title(['Ada', 'Linus', 'Grace', 'Hedy'], 'Kochclub')).toBe('From Ada, Linus and 2 others in Kochclub')
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
  expect(it.push.title(['Ada'], 'Kochclub')).toBe('Da Ada in Kochclub')
  expect(it.push.title(['Ada', 'Linus'], 'Kochclub')).toBe('Da Ada e Linus in Kochclub')
  expect(it.push.title(['Ada', 'Linus', 'Grace', 'Hedy'], 'Kochclub')).toBe('Da Ada, Linus e altri 2 in Kochclub')
  expect(it.push.dishes(2, ['Dal', 'Ramen'], 1)).toBe('2 nuovi piatti: Dal, Ramen e un altro')
  expect(it.push.dishes(2, ['Dal', 'Ramen'], 3)).toBe('2 nuovi piatti: Dal, Ramen e altri 3')
  expect(it.emailDigest.preheader(['Ada', 'Linus', 'Grace', 'Hedy'])).toBe('Da Ada, Linus e altri 2. Dai un’occhiata!')
  expect(it.emailDigest.subject(1, 'Kochclub')).toBe('1 nuovo piatto in Kochclub')
  expect(it.emailDigest.subject(3, null)).toBe('3 nuovi piatti sulle tue bacheche')
})

// Comments and Votes in the push and the Email Digest (#351, the user's
// picks in docs/reviews/comment-and-vote-wordings.md; the push's layout #404).
test('a push about one Comment or one Vote, in each language', () => {
  expect(de.push.comment('Linsen-Dal', 'Mit doppelt Ingwer!')).toBe('Kommentar zu Linsen-Dal: „Mit doppelt Ingwer!“')
  expect(de.push.vote('Linsen-Dal', true)).toBe('Linsen-Dal 👍')
  expect(de.push.vote('Linsen-Dal', false)).toBe('Linsen-Dal 👎')
  expect(en.push.comment('Lentil dal', 'With double ginger!')).toBe('Comment on Lentil dal: “With double ginger!”')
  expect(en.push.vote('Lentil dal', true)).toBe('Lentil dal 👍')
  expect(it.push.comment('Dal di lenticchie', 'Con doppio zenzero!')).toBe('Commento a Dal di lenticchie: “Con doppio zenzero!”')
  expect(it.push.vote('Dal di lenticchie', false)).toBe('Dal di lenticchie 👎')
})

test('a push about one Dish: its Creator and platform, in each language', () => {
  expect(de.push.dish('Linsen-Dal', 'Mara', 'TikTok')).toBe('Linsen-Dal von Mara auf TikTok')
  expect(de.push.dish('Linsen-Dal', null, 'TikTok')).toBe('Linsen-Dal auf TikTok')
  expect(de.push.dish('Linsen-Dal', null, null)).toBe('Linsen-Dal')
  expect(en.push.dish('Lentil dal', 'Mara', 'YouTube')).toBe('Lentil dal by Mara on YouTube')
  expect(it.push.dish('Dal di lenticchie', 'Mara', 'TikTok')).toBe('Dal di lenticchie di Mara su TikTok')
  expect(de.push.dishes(3, ['Dal', 'Ramen'], 1)).toBe('3 neue Gerichte: Dal, Ramen und 1 weiteres')
  expect(en.push.dishes(2, ['Dal', 'Ramen'], 3)).toBe('2 new dishes: Dal, Ramen and 3 more')
})

test('a push about several things on one Dish counts them', () => {
  expect(de.push.talkOn('Linsen-Dal', 1, 1)).toBe('Linsen-Dal: 1 Kommentar, 1 Daumen')
  expect(de.push.talkOn('Linsen-Dal', 3, 0)).toBe('Linsen-Dal: 3 Kommentare')
  expect(en.push.talkOn('Lentil dal', 1, 3)).toBe('Lentil dal: 1 comment, 3 thumbs')
  expect(it.push.talkOn('Dal', 2, 1)).toBe('Dal: 2 commenti, 1 pollice')
})

test('a push about Comments and Votes on several Dishes, alone and with new Dishes', () => {
  expect(de.push.aboutDishes(3, 1, ['Cremige Pilzpasta', 'Linsen-Dal'], 0)).toBe('3 Kommentare und 1 Daumen zu Cremige Pilzpasta und Linsen-Dal')
  expect(de.push.aboutDishes(0, 2, ['Linsen-Dal', 'Ramen'], 3)).toBe('2 Daumen zu Linsen-Dal, Ramen und 3 weitere')
  expect(en.push.aboutDishes(0, 1, ['Lentil dal', 'Ramen'], 3)).toBe('1 thumb on Lentil dal, Ramen and 3 more')
  expect(it.push.aboutDishes(2, 0, ['Dal', 'Ramen'], 0)).toBe('2 commenti su Dal e Ramen')
  expect(de.push.also('Linsen-Dal', 3, 1)).toBe('Linsen-Dal. Dazu 3 Kommentare und 1 Daumen.')
  expect(en.push.also('Lentil dal', 3, 1)).toBe('Lentil dal. Plus 3 comments and 1 thumb.')
  expect(it.push.also('Dal', 1, 2)).toBe('Dal. In più 1 commento e 2 pollici.')
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
