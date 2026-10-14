// Turns a caption or page title into a Suggested Title that reads well on a
// Board: its opening words up to the first emoji, line break or sentence end
// (skipping parts with nothing but hashtags and emojis), out of capitals if
// it shouts, cut to a sensible length.

const MAX_LENGTH = 80

const HASHTAG = /#[\p{L}\p{N}_]+/gu
// Pictographs plus the invisible pieces emoji sequences are built from
// (skin tones, joiners, variation selectors, keycaps, flags).
const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|⃣/gu

// Where a title ends at an emoji: a whole sequence of the pieces EMOJI takes
// out, keycaps like 1️⃣ included, but not ©, ® or ™, which belong to the name
// before them.
const EMOJI_BREAK = /(?:[#*0-9]\uFE0F?\u20E3|(?![©®™])\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200D|\uFE0F)+/u
// Punctuation that may end a sentence, when a space follows.
const SENTENCE_PUNCTUATION = /[.!?]+(?=\s)/gu
const EXCLAIMS_OR_ASKS = /[!?]/
// Abbreviations a full stop follows mid-sentence, in recipes and around them.
const ABBREVIATIONS = new Set([
  'ca', 'nr', 'dr', 'st', 'mr', 'ms', 'mrs', 'jr', 'sr', 'prof', 'vs', 'etc', 'vgl', 'bzw', 'usw', 'inkl', 'exkl', 'evtl', 'ggf', 'zzgl',
  'el', 'tl', 'gr', 'kg', 'mg', 'ml', 'cl', 'dl', 'msp', 'stk', 'pck', 'pkg', 'pers', 'min', 'std', 'sek', 'max', 'tsp', 'tbsp', 'oz', 'lb', 'lbs',
])

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

// "!" and "?" end a sentence; so does a lone full stop after a word (or a
// bracket or quote closing one) of two letters or more that isn't an
// abbreviation. "ca. 500 g", "z.B.", "Nr. 1", "30 Min. fertig", "2.0" and
// "Warte kurz..." go on.
function endsSentence(text: string, punctuation: string, index: number): boolean {
  if (EXCLAIMS_OR_ASKS.test(punctuation)) return true
  if (punctuation !== '.') return false
  const before = /(?:^|[^\p{L}\p{N}.])(\p{L}+)[)\]"'“”’»«]*$/u.exec(text.slice(0, index))?.[1]
  return !!before && before.length >= 2 && !ABBREVIATIONS.has(before.toLowerCase())
}

interface Part { text: string, rest: string }

// The text up to its first emoji or sentence end, and what comes after.
// "!" and "?" stay with the text before them; a full stop and an emoji don't.
function firstPart(text: string): Part {
  const emoji = EMOJI_BREAK.exec(text)
  let end = emoji && { index: emoji.index, length: emoji[0].length, punctuationKept: '' }
  for (const match of text.matchAll(SENTENCE_PUNCTUATION)) {
    if (end && match.index > end.index) break
    if (!endsSentence(text, match[0], match.index)) continue
    end = { index: match.index, length: match[0].length, punctuationKept: EXCLAIMS_OR_ASKS.test(match[0]) ? match[0] : '' }
    break
  }
  if (!end) return { text, rest: '' }
  return { text: text.slice(0, end.index) + end.punctuationKept, rest: text.slice(end.index + end.length) }
}

// A word: letters with case and digits, joined by apostrophes ("MOM'S",
// "5MIN"). Spaces, hyphens, brackets, quotes and letters without case (寿司)
// all separate words.
const WORD = /[\p{LC}\p{M}\p{N}]+(?:['’][\p{LC}\p{M}\p{N}]+)*/gu
// Shorter words are left out of deciding whether a title shouts, since that
// is how acronyms look ("BBQ", "XXL").
const LONG_WORD_LETTERS = 4
const HYPHEN = /^[-\u2010\u2011]$/u

// No small letters but ß, which has no everyday capital ("SOßE").
function inCaps(word: string): boolean {
  return /\p{Lu}/u.test(word) && !/\p{Ll}/u.test(word.replaceAll('ß', ''))
}

function isLong(word: string): boolean {
  return (word.match(/\p{LC}/gu)?.length ?? 0) >= LONG_WORD_LETTERS
}

function capitalised(word: string): string {
  return word.toLowerCase()
    .replace(/^\p{L}/u, letter => letter.toUpperCase())
    // A one-letter prefix and its apostrophe start a name: O'Brien, D'Artagnan.
    .replace(/^(\p{L}['’])(\p{L})(?=\p{L})/u, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())
}

// A short word without a vowel ("BBQ", "XXL", "TK") is an acronym.
const VOWEL = /[aeiouyäöüàáâãåæèéêëìíîïòóôõøœùúûý]/iu

function isAcronym(word: string): boolean {
  return !isLong(word) && !VOWEL.test(word)
}

interface Word {
  text: string
  start: number
  end: number
  caps: boolean
  // Has letters with case, unlike "15".
  cased: boolean
}

function wordsOf(title: string): Word[] {
  return [...title.matchAll(WORD)].map(match => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
    caps: inCaps(match[0]),
    cased: /\p{LC}/u.test(match[0]),
  }))
}

// Runs of words in capitals as [first, past-last) positions in `words`. A
// number doesn't break a run: "ZUTATEN FÜR 2 PORTIONEN" is one.
function capsRuns(words: Word[]): Array<[number, number]> {
  const runs: Array<[number, number]> = []
  for (let start = 0; start < words.length; start++) {
    if (!words[start]!.caps) continue
    let end = start + 1
    while (end < words.length && (words[end]!.caps || !words[end]!.cased)) end++
    runs.push([start, end])
    start = end - 1
  }
  return runs
}

// "TOFU-NUGGETS AUS DEM AIRFRYER" → "Tofu-Nuggets aus dem Airfryer". A title
// shouts when at least two of its longer words are in capitals. Then each run
// of words in capitals that has a longer word in it is put into normal case:
// longer words and every part of a hyphenated word capitalised, shorter words
// lowered unless they open or close the title, acronyms kept. Every other word
// stays as written, and so does a run of short words only ("vom BBQ"), which
// is how acronyms look. "SS" is never guessed to be "ß".
function uncapitalise(title: string): string {
  const words = wordsOf(title)
  if (words.filter(word => word.caps && isLong(word.text)).length < 2) return title

  const cased = words.filter(word => word.cased)
  const opensOrCloses = (word: Word) => word === cased[0] || word === cased[cased.length - 1]
  const joinedByHyphen = (left: Word | undefined, right: Word | undefined) =>
    !!left && !!right && right.start === left.end + 1 && HYPHEN.test(title[left.end]!)
  const hyphenated = (at: number) => joinedByHyphen(words[at - 1], words[at]) || joinedByHyphen(words[at], words[at + 1])

  const normalised = words.map(word => word.text)
  for (const [start, end] of capsRuns(words)) {
    if (!words.slice(start, end).some(word => word.caps && isLong(word.text))) continue
    for (let at = start; at < end; at++) {
      const word = words[at]!
      if (!word.caps || isAcronym(word.text)) continue
      normalised[at] = isLong(word.text) || opensOrCloses(word) || hyphenated(at)
        ? capitalised(word.text)
        : word.text.toLowerCase()
    }
  }
  let at = 0
  return title.replace(WORD, () => normalised[at++]!)
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
    let rest = line
    while (rest) {
      const part = firstPart(rest)
      const cleaned = cleanLine(part.text)
      // A part without a letter, like a lone "5" before an emoji, is no title.
      if (/\p{L}/u.test(cleaned)) return cutText(uncapitalise(cleaned), MAX_LENGTH)
      rest = part.rest
    }
  }
  return ''
}
