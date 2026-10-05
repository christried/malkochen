import { cutText } from './title'

// The Creator as a Source names it: one line, without surrounding spaces,
// cut to a length a card's line can hold. Null when there is none.

const MAX_LENGTH = 100

export function creatorName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/\s+/g, ' ').trim()
  return name ? cutText(name, MAX_LENGTH) : null
}
