// Turns a caption or page title into a Suggested Title that reads well on a
// Board: the first line that still says something once hashtags and emojis
// are gone, out of capitals if it shouts, cut to a sensible length.

const MAX_LENGTH = 80

const HASHTAG = /#[\p{L}\p{N}_]+/gu
// Pictographs plus the invisible pieces emoji sequences are built from
// (skin tones, joiners, variation selectors, keycaps, flags).
const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|⃣/gu

// Instagram captions pad with the blank Braille pattern, which isn't \s.
const BLANK = /\u2800/g

function cleanLine(line: string): string {
  return line
    .replace(BLANK, ' ')
    .replace(HASHTAG, ' ')
    .replace(EMOJI, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Separators left dangling once a hashtag or emoji after them is gone.
    .replace(/[\s,;:|·•–—-]+$/u, '')
    .replace(/^[\s,;:|·•–—-]+/u, '')
}

// A word: letters with case and digits, joined by apostrophes ("MOM'S",
// "5MIN"). Spaces, hyphens, brackets, quotes and letters without case (寿司)
// all separate words.
const WORD = /[\p{LC}\p{M}\p{N}]+(?:['’][\p{LC}\p{M}\p{N}]+)*/gu
// Shorter words are left out of deciding whether a title shouts, since that
// is how acronyms look ("BBQ", "XXL").
const LONG_WORD_LETTERS = 4

// No small letters but ß, which has no everyday capital ("SOßE").
function inCaps(word: string): boolean {
  return /\p{Lu}/u.test(word) && !/\p{Ll}/u.test(word.replaceAll('ß', ''))
}

function capitalised(word: string): string {
  return word.toLowerCase()
    .replace(/^\p{L}/u, letter => letter.toUpperCase())
    // A one-letter prefix and its apostrophe start a name: O'Brien, D'Artagnan.
    .replace(/^(\p{L}['’])(\p{L})(?=\p{L})/u, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())
}

// "CREMIGE PILZPASTA" → "Cremige Pilzpasta". A title shouts when most of its
// longer words are in capitals; then each word in capitals is capitalised
// and every other word stays as written. A title that doesn't shout stays as
// it is, acronyms included. "SS" is never guessed to be "ß".
function uncapitalise(title: string): string {
  const longWords = (title.match(WORD) ?? []).filter(word => (word.match(/\p{LC}/gu)?.length ?? 0) >= LONG_WORD_LETTERS)
  const shouting = longWords.filter(inCaps).length * 2 > longWords.length
  return shouting ? title.replace(WORD, word => inCaps(word) ? capitalised(word) : word) : title
}

// Text longer than `max` cut to fit with "…": at its last space if that
// keeps at least half, and never inside an emoji.
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text
  const head = text.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '')
  const lastSpace = head.lastIndexOf(' ')
  const kept = lastSpace >= max / 2 ? head.slice(0, lastSpace) : head
  return `${kept.replace(/[\s,;:|·•–—-]+$/u, '')}…`
}

export function shortenTitle(raw: string | null | undefined): string {
  if (!raw) return ''
  // Line breaks, and the line separators some captions use instead.
  for (const line of raw.split(/\r?\n|[\u2028\u2029]/)) {
    const cleaned = cleanLine(line)
    if (/[\p{L}\p{N}]/u.test(cleaned)) return cutText(uncapitalise(cleaned), MAX_LENGTH)
  }
  return ''
}
