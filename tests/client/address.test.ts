import { expect, test } from 'vitest'
import { boardPath, dishAt, dishPath, slugify } from '../../shared/address'

// Seam 4: readable addresses (issue #127). A Board's address is made from
// its name, a Dish's from its title and its short code, which alone
// identifies it.

test('a name becomes lower case words joined by dashes, umlauts spelled out and emoji dropped', () => {
  expect(slugify('Kochclub')).toBe('kochclub')
  expect(slugify('🍜 Meine Küche')).toBe('meine-kueche')
  expect(slugify('Öfen, Äpfel & Grüße!')).toBe('oefen-aepfel-gruesse')
  expect(slugify('STRASSE ẞ')).toBe('strasse-ss')
  expect(slugify('Crème brûlée  à la Maman')).toBe('creme-brulee-a-la-maman')
  expect(slugify('  --Pasta 2.0-- ')).toBe('pasta-2-0')
  expect(slugify('🍜🍲')).toBe('')
})

test('a long name gives an address of at most 60 characters, never ending in a dash', () => {
  const slug = slugify(`${'a'.repeat(59)} bcd`)
  expect(slug).toBe('a'.repeat(59))
  expect(slugify('ä'.repeat(40))).toHaveLength(60)
})

test('a Board is at /b/ and its address; a Dish under it, its title before its code', () => {
  const board = { slug: 'kochclub' }
  expect(boardPath(board)).toBe('/b/kochclub')
  expect(dishPath(board, { title: 'Omas Linsensuppe', code: '3f9k' })).toBe('/b/kochclub/omas-linsensuppe-3f9k')
  expect(dishPath(board, { title: '🍜', code: '3f9k' })).toBe('/b/kochclub/3f9k')
})

test('a Dish is found by the code at the end of its address, whatever the title before it says', () => {
  const soup = { id: '6f1c2a52-0d39-4f7e-9b39-1a0e0b8f6a10', title: 'Omas Linsensuppe', code: '3f9k' }
  const pasta = { id: '0b8f6a10-0d39-4f7e-9b39-6f1c2a521a0e', title: 'Pasta', code: 'x7mz' }
  const board = { columns: [{ id: 'ideen', dishes: [pasta] }, { id: 'gekocht', dishes: [soup] }] }

  expect(dishAt(board, 'omas-linsensuppe-3f9k')).toEqual({ dish: soup, column: board.columns[1] })
  expect(dishAt(board, 'linsen-3f9k')?.dish).toBe(soup)
  expect(dishAt(board, '3f9k')?.dish).toBe(soup)
  // Its old address, by its id.
  expect(dishAt(board, pasta.id)?.dish).toBe(pasta)
  expect(dishAt(board, 'omas-linsensuppe-zzzz')).toBeNull()
  expect(dishAt(board, 'omas-linsensuppe')).toBeNull()
  expect(dishAt(board, undefined)).toBeNull()
})
