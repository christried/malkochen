// What Topfbert says in the Gekocht celebration (TopfbertCheer): one of his
// cheers (strings: dish.cheers) at random for each Gekocht toast, never the
// one he said last.

// One of `items` at random, other than `last` (unless it's the only one).
export function pickOtherThan<T>(items: readonly T[], last: T | undefined, random: () => number = Math.random): T {
  const others = items.filter(item => item !== last)
  const from = others.length ? others : items
  return from[Math.floor(random() * from.length)]!
}

// Remembered for this page, so two Cookings in a row get different cheers.
// Only ever picked in the browser, on a Cooking.
let lastCheer: string | undefined

export function nextCheer(cheers: readonly string[]): string {
  lastCheer = pickOtherThan(cheers, lastCheer)
  return lastCheer
}
