// Each Column's accent (handoff tokens.json → color.semantic.column-n):
// butter, orchid, sage, then on through carrot and sky, round and round.
const ACCENTS = ['butter', 'orchid', 'sage', 'carrot', 'sky'] as const

export function columnAccent(index: number): string {
  return `var(--color-${ACCENTS[index % ACCENTS.length]})`
}

// The accent part way from one Column to the next, as while swiping: a
// progress of 1.25 is a quarter of the way from the second to the third.
export function accentAt(progress: number): string {
  const from = Math.floor(progress)
  const along = progress - from
  if (along === 0) return columnAccent(from)
  return `color-mix(in oklch, ${columnAccent(from)}, ${columnAccent(from + 1)} ${along * 100}%)`
}
