// Where a sentence ends in the text of a caption, a page title or a recipe.

// Punctuation that may end a sentence, when a space follows.
export const SENTENCE_PUNCTUATION = /[.!?]+(?=\s)/gu
export const EXCLAIMS_OR_ASKS = /[!?]/
// Abbreviations a full stop follows mid-sentence, in recipes and around them.
const ABBREVIATIONS = new Set([
  'ca', 'nr', 'dr', 'st', 'mr', 'ms', 'mrs', 'jr', 'sr', 'prof', 'vs', 'etc', 'vgl', 'bzw', 'usw', 'inkl', 'exkl', 'evtl', 'ggf', 'zzgl',
  'el', 'tl', 'gr', 'kg', 'mg', 'ml', 'cl', 'dl', 'msp', 'stk', 'pck', 'pkg', 'pers', 'min', 'std', 'sek', 'max', 'tsp', 'tbsp', 'oz', 'lb', 'lbs',
])

// "!" and "?" end a sentence; so does a lone full stop after a word (or a
// bracket or quote closing one) of two letters or more that isn't an
// abbreviation. "ca. 500 g", "z.B.", "Nr. 1", "30 Min. fertig", "2.0" and
// "Warte kurz..." go on.
export function endsSentence(text: string, punctuation: string, index: number): boolean {
  if (EXCLAIMS_OR_ASKS.test(punctuation)) return true
  if (punctuation !== '.') return false
  const before = /(?:^|[^\p{L}\p{N}.])(\p{L}+)[)\]"'“”’»«]*$/u.exec(text.slice(0, index))?.[1]
  return !!before && before.length >= 2 && !ABBREVIATIONS.has(before.toLowerCase())
}

// The sentences of a line of text, each as written, its punctuation kept.
// Where a sentence end can't be told for sure, the text stays together.
export function sentencesOf(text: string): string[] {
  const sentences: string[] = []
  let start = 0
  for (const match of text.matchAll(SENTENCE_PUNCTUATION)) {
    if (!endsSentence(text, match[0], match.index)) continue
    const end = match.index + match[0].length
    sentences.push(text.slice(start, end).trim())
    start = end
  }
  sentences.push(text.slice(start).trim())
  return sentences.filter(Boolean)
}
