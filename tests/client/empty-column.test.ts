import { expect, test } from 'vitest'
import { EMPTY_COLUMN_ILLUSTRATIONS, emptyColumnIllustration, emptyColumnOrder } from '../../app/utils/empty-column'

// Seam 4: which illustration an empty Column shows. Each Board shuffles the
// three once, seeded by the Board, and its Columns take them by position.
const boardIds = Array.from({ length: 60 }, (_, i) => `0b7c${i.toString(16).padStart(4, '0')}-5e1a-4c2d-9f3b-${(i * 7919).toString(16).padStart(12, '0')}`)

test('a Board\'s order holds each of the three illustrations once', () => {
  for (const boardId of boardIds) {
    expect([...emptyColumnOrder(boardId)].sort()).toEqual([...EMPTY_COLUMN_ILLUSTRATIONS].sort())
  }
})

test('a Board\'s order is the same every time it is asked for', () => {
  for (const boardId of boardIds) {
    expect(emptyColumnOrder(boardId)).toEqual(emptyColumnOrder(boardId))
  }
})

test('Boards differ in their order, and every order comes up', () => {
  const orders = new Set(boardIds.map(boardId => emptyColumnOrder(boardId).join()))
  // Three illustrations have six orders.
  expect(orders.size).toBe(6)
})

test('a Board\'s first three Columns show three different illustrations', () => {
  for (const boardId of boardIds) {
    const firstThree = [0, 1, 2].map(index => emptyColumnIllustration(boardId, index))
    expect(new Set(firstThree).size).toBe(3)
  }
})

test('further Columns repeat the order', () => {
  const boardId = boardIds[0]!
  const order = emptyColumnOrder(boardId)
  for (let index = 0; index < 10; index++) {
    expect(emptyColumnIllustration(boardId, index)).toBe(order[index % 3])
  }
})
