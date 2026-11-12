import { expect, test } from 'vitest'
import { de } from '../../app/strings/de'
import { en } from '../../app/strings/en'
import { it } from '../../app/strings/it'

// What the Week Plan says when a Dish is planned from its detail, and how a
// Planned Dish is named for a screen reader (#518), in each language. A
// Thursday, with the next week's Thursday after it.
const TODAY = '2026-11-12'

test.each([
  ['2026-11-12', 'Für heute eingeplant.'],
  ['2026-11-13', 'Für morgen eingeplant.'],
  ['2026-11-15', 'Für Sonntag eingeplant.'],
  ['2026-11-19', 'Für Donnerstag, 19. November eingeplant.'],
])('planned on %s, German: %s', (day, text) => {
  expect(de.week.planned(day, TODAY)).toBe(text)
})

test('planned today and tomorrow, English and Italian', () => {
  expect(en.week.planned('2026-11-12', TODAY)).toBe('Planned for today.')
  expect(en.week.planned('2026-11-13', TODAY)).toBe('Planned for tomorrow.')
  expect(it.week.planned('2026-11-12', TODAY)).toBe('Pianificato per oggi.')
  expect(it.week.planned('2026-11-13', TODAY)).toBe('Pianificato per domani.')
})

test('a Planned Dish names its day, its cook and whether it is cooked', () => {
  expect(de.week.plannedDish('Linsensuppe', '2026-11-12')).toBe('Linsensuppe, Donnerstag')
  expect(de.week.plannedDish('Linsensuppe', '2026-11-12', null, false)).toBe('Linsensuppe, Donnerstag')
  expect(de.week.plannedDish('Linsensuppe', '2026-11-12', 'Mia', true)).toBe('Linsensuppe, Donnerstag, kocht Mia, gekocht')
  expect(en.week.plannedDish('Lentil soup', '2026-11-12', 'Mia')).toBe('Lentil soup, Thursday, Mia is cooking')
  expect(it.week.plannedDish('Zuppa di lenticchie', '2026-11-12', 'Mia', true)).toBe('Zuppa di lenticchie, giovedì, cucina Mia, cucinato')
})
