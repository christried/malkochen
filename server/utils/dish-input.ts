import { z } from 'zod'
import { guessSource, SOURCE_KINDS, type SourceKind } from '../source-lookup'
import type { DishSource } from './dishes'

// What adding and editing a Dish accept from the client, shared by both.

export const webLink = z.url({ protocol: /^https?$/ }).max(2048)

export const dishTitle = z.string().trim().min(1).max(200)

// Optional; a blank note is no note.
export const dishNote = z.string().trim().max(2000).nullish().transform(note => note || null)

// The canonical link and kind from Source Lookup. The kind is read from the
// link itself; the one sent only tells a blog from any other web page.
export const sourceInput = z.object({ link: webLink, kind: z.enum(SOURCE_KINDS).optional() })

export function sourceOf(input: { link: string, kind?: SourceKind }): DishSource {
  const guess = guessSource(input.link)
  const isBlog = guess.kind === 'other' && input.kind === 'blog'
  return { link: guess.canonicalLink, kind: isBlog ? 'blog' : guess.kind }
}
