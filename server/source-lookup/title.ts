// Turns a caption or page title into a Suggested Title that reads well on a
// Board: the first line that still says something once hashtags and emojis
// are gone, out of capitals if it shouts, cut to a sensible length.

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

// A title counts as shouting when more than this share of its cased letters
// are capitals. Keeps "Pasta mit BBQ-TOFU" (about half) as it is.
const CAPS_SHARE = 0.6

// A letter that starts a word: not after a letter, a digit or a letter's
// apostrophe ("Mom's", "5min"), but after spaces, hyphens, brackets, quotes.
const WORD_START = /(?<![\p{L}\p{M}\p{N}]['’]?)\p{L}/gu

// "CREMIGE PILZPASTA" → "Cremige Pilzpasta". Anything not mostly capitals,
// acronyms in it included, stays as written. "SS" is never guessed to be "ß".
function uncapitalise(title: string): string {
  const upper = title.match(/\p{Lu}/gu)?.length ?? 0
  const lower = title.match(/\p{Ll}/gu)?.length ?? 0
  if (upper <= CAPS_SHARE * (upper + lower)) return title
  return title.toLowerCase().replace(WORD_START, letter => letter.toUpperCase())
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
    if (/[\p{L}\p{N}]/u.test(cleaned)) return cut(uncapitalise(cleaned))
  }
  return ''
}
