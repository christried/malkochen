// Which illustration an empty Column shows (Round 11's three empty-Column
// clips): the pea in a bowl, Knobi the garlic and Schoti the chili. Each
// Board shuffles the three once, seeded by its id, so the order stays put
// across reloads and is the same for every Member, but differs between
// Boards. Its Columns take them by position, round and round.
import { hashString, seededRandom } from './seeded'

export const EMPTY_COLUMN_ILLUSTRATIONS = ['empty-column', 'empty-column-knobi', 'empty-column-schoti'] as const
export type EmptyColumnIllustration = typeof EMPTY_COLUMN_ILLUSTRATIONS[number]

export function emptyColumnOrder(boardId: string): EmptyColumnIllustration[] {
  const random = seededRandom(hashString(boardId))
  const order: EmptyColumnIllustration[] = [...EMPTY_COLUMN_ILLUSTRATIONS]
  // Fisher–Yates.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return order
}

export function emptyColumnIllustration(boardId: string, index: number): EmptyColumnIllustration {
  const order = emptyColumnOrder(boardId)
  return order[index % order.length]!
}
