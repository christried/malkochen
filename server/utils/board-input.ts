import { z } from 'zod'

// What Board settings accept from the client.

export const boardName = z.string().trim().min(1).max(60)

export const columnName = z.string().trim().min(1).max(40)

// One emoji: a single grapheme that is a pictograph, so skin tones, flags
// and ZWJ sequences (🧑‍🍳) count as one, and text or two emojis don't.
export const boardEmoji = z.string().trim().refine((text) => {
  const graphemes = [...new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(text)]
  return graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(text)
})
