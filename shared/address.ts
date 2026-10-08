import { dishOnBoard } from './board'

// Readable addresses (CONTEXT.md: Address). A Board is at /b/<its slug>,
// made from its name and unique across all Boards (the server picks it:
// server/utils/addresses.ts); a Dish at /b/<Board slug>/<title slug>-<code>,
// where the short code alone identifies it, so the title part may be stale.
// Ids stay internal: an old address by id forwards to these.

// The longest a slug gets, in characters.
const MAX_SLUG = 60

const SPELLED_OUT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'ae', Ö: 'oe', Ü: 'ue', ẞ: 'ss' }

// A name as lower case words joined by dashes: umlauts as ae/oe/ue, ß as ss,
// other accents dropped from their letters, emoji and anything else that
// isn't a letter or digit dropped. Empty if nothing is left.
export function slugify(text: string): string {
  return text
    .replace(/[äöüßÄÖÜẞ]/g, letter => SPELLED_OUT[letter] ?? letter)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '')
}

// What follows /b/<Board slug>/ for a Dish: its title's slug, then its code.
export function dishSegment(dish: { title: string, code: string }): string {
  const title = slugify(dish.title)
  return title ? `${title}-${dish.code}` : dish.code
}

export function boardPath(board: { slug: string }): string {
  return `/b/${board.slug}`
}

export function boardSettingsPath(board: { slug: string }): string {
  return `${boardPath(board)}/settings`
}

export function dishPath(board: { slug: string }, dish: { title: string, code: string }): string {
  return `${boardPath(board)}/${dishSegment(dish)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(text: string): boolean {
  return UUID.test(text)
}

// The code a Dish's address ends in, or its id if it is an old address.
export function dishRef(segment: string): { id: string } | { code: string } {
  return isUuid(segment) ? { id: segment } : { code: segment.slice(segment.lastIndexOf('-') + 1) }
}

// The Dish (and its Column) a Dish address on this Board points at, by its
// code, or by its id for an old address; null if it isn't on the Board.
export function dishAt<C extends { dishes: { id: string, code: string }[] }>(
  board: { columns: C[] },
  segment: unknown,
): { dish: C['dishes'][number], column: C } | null {
  if (typeof segment !== 'string') return null
  const ref = dishRef(segment)
  if ('id' in ref) return dishOnBoard(board, ref.id)
  for (const column of board.columns) {
    const dish = column.dishes.find(d => d.code === ref.code)
    if (dish) return { dish, column }
  }
  return null
}
