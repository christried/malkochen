import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { autoPlaceholder, PLACEHOLDER_THEMES, PLACEHOLDERS } from '../../shared/placeholders'

// The 12 Placeholder Images (ADR 0004) and the automatic pick for a new
// Dish (handoff illustrations.json autoPick): title keywords first, then the
// words of the link's path, else "bowl".

test('there are exactly the 12 Placeholder Images, each with its still and loop in both themes', () => {
  expect([...PLACEHOLDERS].sort()).toEqual([
    'bowl', 'bread', 'breakfast', 'burger', 'cake', 'dumplings',
    'eintopf', 'pasta', 'ramen', 'smoothie', 'tacos', 'wok',
  ])
  const files = readdirSync('public/placeholders')
  expect(files.sort()).toEqual(PLACEHOLDERS.flatMap(p => PLACEHOLDER_THEMES.map(theme => `${p}-${theme}.svg`)).sort())
  for (const file of files) {
    // The still is the loop's frame 0: one file, with its animated layers.
    expect(readFileSync(`public/placeholders/${file}`, 'utf8'), file).toMatch(/data-loop="[^"]+"/)
  }
})

test('a title picks the drawing its dish is', () => {
  expect(autoPlaceholder('Spaghetti', null)).toBe('pasta')
  expect(autoPlaceholder('Quinoa Bowl', null)).toBe('bowl')
  expect(autoPlaceholder('Pancakes', null)).toBe('breakfast')
  expect(autoPlaceholder('Miso Ramen', null)).toBe('ramen')
  expect(autoPlaceholder('Smash Burger', null)).toBe('burger')
  expect(autoPlaceholder('Käsekuchen', null)).toBe('cake')
  expect(autoPlaceholder('Linsensuppe', null)).toBe('eintopf')
})

test('the words are found in any case, with or without accents, singular or plural', () => {
  expect(autoPlaceholder('VEGANE CRÊPES', null)).toBe('breakfast')
  expect(autoPlaceholder('Crepes mit Apfelmus', null)).toBe('breakfast')
  expect(autoPlaceholder('Müsli', null)).toBe('breakfast')
  expect(autoPlaceholder('Bandnudeln mit Pilzen', null)).toBe('pasta')
  expect(autoPlaceholder('Knusprige Tacos', null)).toBe('tacos')
  expect(autoPlaceholder('Overnight Oats', null)).toBe('breakfast')
  expect(autoPlaceholder('French Toast', null)).toBe('breakfast')
})

test('the last part of a German compound counts: a Gemüsecurry is a curry', () => {
  expect(autoPlaceholder('Gemüsecurry', null)).toBe('bowl')
  expect(autoPlaceholder('Kartoffelsalat', null)).toBe('bowl')
  expect(autoPlaceholder('Bananenbrot', null)).toBe('bread')
  // A whole word wins over a word's end: Pfannkuchen are no Kuchen.
  expect(autoPlaceholder('Pfannkuchen', null)).toBe('breakfast')
})

test('a short keyword only counts as a whole word', () => {
  expect(autoPlaceholder('Mac and Cheese', null)).toBe('pasta')
  expect(autoPlaceholder('Dal', null)).toBe('bowl')
  // "Sandale" ends in neither "dal" nor any other dish.
  expect(autoPlaceholder('Sandale', null)).toBe('bowl')
})

test('several dishes in a title: the first one named', () => {
  expect(autoPlaceholder('Kürbis-Eintopf mit Brot', null)).toBe('eintopf')
  expect(autoPlaceholder('Brot mit Kürbis-Eintopf', null)).toBe('bread')
  expect(autoPlaceholder('Smoothie Bowl', null)).toBe('smoothie')
})

test('the removed images’ dishes go where their Dishes went (ADR 0004)', () => {
  expect(autoPlaceholder('Kichererbsen-Curry', null)).toBe('bowl')
  expect(autoPlaceholder('Pizza Margherita', null)).toBe('bread')
  expect(autoPlaceholder('Porridge', null)).toBe('breakfast')
  expect(autoPlaceholder('Wrap mit Falafel', null)).toBe('tacos')
})

test('without a dish in the title, the link’s path names it', () => {
  expect(autoPlaceholder('Omas Rezept', 'https://www.chefkoch.de/rezepte/123/vegane-spaghetti-bolognese.html')).toBe('pasta')
  expect(autoPlaceholder('', 'https://koch.example/blog/fluffy-pancakes')).toBe('breakfast')
  // The title comes first.
  expect(autoPlaceholder('Ramen', 'https://koch.example/blog/fluffy-pancakes')).toBe('ramen')
  // Only the path: the host is no dish.
  expect(autoPlaceholder('', 'https://pasta.example/rezept/123')).toBe('bowl')
})

test('nothing found, or no usable link: "bowl"', () => {
  expect(autoPlaceholder('', null)).toBe('bowl')
  expect(autoPlaceholder('Etwas Leckeres', 'https://www.tiktok.com/@vegan/video/7300000000000000000')).toBe('bowl')
  expect(autoPlaceholder('Etwas Leckeres', 'kein link')).toBe('bowl')
})
