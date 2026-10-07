// Picks that look random but stay put: the same string always gives the same
// numbers, for every Member and across reloads (an empty Column's
// illustration, a Dish's "never cooked" scene).

// FNV-1a: a string to 32 bits.
export function hashString(text: string): number {
  let h = 0x811C9DC5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32: numbers in [0, 1), the same ones for the same seed.
export function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
