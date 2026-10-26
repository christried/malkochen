import { cutText } from './title'

// The Caption (CONTEXT.md): the text a Source shows with its post, as plain
// text, trimmed and cut to a few thousand characters. Null when there is none.

const MAX_LENGTH = 4000

export function captionOf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\r\n?/g, '\n').trim()
  return text ? cutText(text, MAX_LENGTH) : null
}
