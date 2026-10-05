// How Columns look and move, shared by the Board and its Column tabs.

// Each Column's accent (handoff tokens.json → color.semantic.column-n):
// butter, orchid, sage, then on through carrot and sky, round and round.
const ACCENTS = ['butter', 'orchid', 'sage', 'carrot', 'sky'] as const
export type ColumnAccent = typeof ACCENTS[number]

// The accent's name, for art drawn once per accent (the empty Column's).
export function columnAccentName(index: number): ColumnAccent {
  return ACCENTS[index % ACCENTS.length]!
}

export function columnAccent(index: number): string {
  return `var(--color-${columnAccentName(index)})`
}

// The page behind the lanes once every Column shows (tablet and desktop): a
// soft gradient across the Column accents from left to right, each washed
// into the background (--wash-page, main.css).
export function boardGradient(count: number): string {
  // A gradient takes two stops: a single Column's accent fills it evenly.
  const last = Math.max(count, 1) - 1
  const stops = Array.from({ length: Math.max(count, 2) }, (_, i) =>
    `color-mix(in oklab, ${columnAccent(Math.min(i, last))} var(--wash-page), var(--color-bg))`)
  return `linear-gradient(to right, ${stops.join(', ')})`
}

// A swipe's progress (a Column index, fractional mid-swipe) kept on the
// Board: rubber-banding past either end doesn't go beyond the first or last.
export function clampProgress(progress: number, count: number): number {
  return Math.max(0, Math.min(progress, count - 1))
}

// The accent part way from one Column to the next, as while swiping: a
// progress of 1.25 is a quarter of the way from the second to the third.
export function accentAt(progress: number): string {
  const from = Math.floor(progress)
  const along = progress - from
  if (along === 0) return columnAccent(from)
  return `color-mix(in oklch, ${columnAccent(from)}, ${columnAccent(from + 1)} ${along * 100}%)`
}

// The pebble shape of a Column's tab: three radii, taken in turn.
export function tabRadius(index: number): string {
  return `var(--radius-tab-${(index % 3) + 1})`
}

// Phones show one Column at a time (handoff breakpoints: phone < 768px).
export function isPhoneLayout(): boolean {
  return matchMedia('(max-width: 767.98px)').matches
}

// How a Column's tab (phones) or title (lanes) reacts to a Dish coming in:
// a dropped Dish makes it squash and burst, a Cooking bumps it, the Gekocht
// pebble bursts as it lands.
export interface ColumnCue {
  columnId: string
  kind: 'drop' | 'bump' | 'pebble'
}
