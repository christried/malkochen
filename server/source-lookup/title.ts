// Turns a caption or page title into a Suggested Title that reads well on a
// Board: the first line that still says something once hashtags and emojis
// are gone, cut to a sensible length.

const MAX_LENGTH = 80

const HASHTAG = /#[\p{L}\p{N}_]+/gu
// Pictographs plus the invisible pieces emoji sequences are built from
// (skin tones, joiners, variation selectors, keycaps, flags).
const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|⃣/gu

function cleanLine(line: string): string {
  return line
    .replace(HASHTAG, ' ')
    .replace(EMOJI, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Separators left dangling once a hashtag or emoji after them is gone.
    .replace(/[\s,;:|·•–—-]+$/u, '')
    .replace(/^[\s,;:|·•–—-]+/u, '')
}

function cut(title: string): string {
  if (title.length <= MAX_LENGTH) return title
  const head = title.slice(0, MAX_LENGTH - 1)
  const lastSpace = head.lastIndexOf(' ')
  const kept = lastSpace >= MAX_LENGTH / 2 ? head.slice(0, lastSpace) : head
  return `${kept.replace(/[\s,;:|·•–—-]+$/u, '')}…`
}

export function shortenTitle(raw: string | null | undefined): string {
  if (!raw) return ''
  for (const line of raw.split(/\r?\n/)) {
    const cleaned = cleanLine(line)
    if (/[\p{L}\p{N}]/u.test(cleaned)) return cut(cleaned)
  }
  return ''
}
