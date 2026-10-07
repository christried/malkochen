// Which illustration an empty Column shows (Round 11's three empty-Column
// clips): the pea in a bowl, Knobi the garlic and Schoti the chili. Each
// Board shuffles the three once, seeded by its id, so the order stays put
// across reloads and is the same for every Member, but differs between
// Boards. Its Columns take them by position, round and round.
export const EMPTY_COLUMN_ILLUSTRATIONS = ['empty-column', 'empty-column-knobi', 'empty-column-schoti'] as const
export type EmptyColumnIllustration = typeof EMPTY_COLUMN_ILLUSTRATIONS[number]

export function emptyColumnOrder(boardId: string): EmptyColumnIllustration[] {
  const random = seededRandom(hash(boardId))
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

// FNV-1a: a string to 32 bits.
function hash(text: string): number {
  let h = 0x811C9DC5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32: numbers in [0, 1), the same ones for the same seed.
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
