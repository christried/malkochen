import { expect, test } from 'vitest'
import { de } from '../../app/strings/de'
import { nextCheer, pickAnother } from '../../app/utils/cheer'

// Topfbert's speech bubble in the Gekocht celebration (#114): a different
// short cheer each time, never the same one twice in a row.

const ITEMS = ['Mmh!', 'Lecker!', 'Yes, Chef!'] as const

test('never picks the one picked last, whatever the dice say', () => {
  for (const last of ITEMS) {
    for (const roll of [0, 0.34, 0.5, 0.67, 0.999]) {
      expect(pickAnother(ITEMS, last, () => roll)).not.toBe(last)
    }
  }
})

test('every other one can come up', () => {
  const rolls = [0, 0.25, 0.5, 0.75, 0.999]
  const picked = new Set(rolls.map(roll => pickAnother(ITEMS, 'Mmh!', () => roll)))
  expect([...picked].sort()).toEqual(['Lecker!', 'Yes, Chef!'])
})

test('the first pick can be any of them', () => {
  const picked = new Set([0, 0.5, 0.999].map(roll => pickAnother(ITEMS, undefined, () => roll)))
  expect(picked.size).toBe(3)
})

test('with only one, that one comes again', () => {
  expect(pickAnother(['Mmh!'], 'Mmh!', () => 0.5)).toBe('Mmh!')
})

test('Topfbert never says the same cheer twice in a row, and says them all', () => {
  const said = Array.from({ length: 500 }, () => nextCheer(de.dish.cheers))
  for (const [i, cheer] of said.entries()) {
    if (i > 0) expect(cheer, `cheer ${i}`).not.toBe(said[i - 1])
  }
  expect(new Set(said)).toEqual(new Set(de.dish.cheers))
})

test('he has at least 12 cheers, each different and one to three words', () => {
  const cheers = de.dish.cheers
  expect(cheers.length).toBeGreaterThanOrEqual(12)
  expect(new Set(cheers).size).toBe(cheers.length)
  for (const cheer of cheers) {
    expect(cheer.split(/\s+/).length, cheer).toBeLessThanOrEqual(3)
  }
})
