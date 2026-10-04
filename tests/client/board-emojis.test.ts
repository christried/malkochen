import { expect, test } from 'vitest'
import { BOARD_EMOJIS } from '../../app/utils/board-emojis'

// Seam 4: the emojis a Board can pick from. Only vegan or veganisable food:
// none of meat, fish, seafood, egg or dairy.
const ANIMAL_PRODUCTS = [
  '🍖', '🍗', '🥩', '🥓', '🌭',
  '🐟', '🐠', '🍣', '🍤', '🍥', '🍢', '🦐', '🦞', '🦀', '🦑', '🐙', '🦪',
  '🥚', '🍳',
  '🧀', '🧈', '🥛', '🫕',
]

test('a Board can pick no meat, fish, egg or dairy emoji', () => {
  expect(BOARD_EMOJIS.filter(emoji => ANIMAL_PRODUCTS.includes(emoji))).toEqual([])
})

test('a Board picks from full rows of seven, each emoji once', () => {
  expect(BOARD_EMOJIS.length % 7).toBe(0)
  expect(new Set(BOARD_EMOJIS).size).toBe(BOARD_EMOJIS.length)
})
