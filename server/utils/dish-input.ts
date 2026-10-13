import { z } from 'zod'
import { PLACEHOLDERS } from '../../shared/placeholders'
import { guessSource, SOURCE_KINDS } from '../source-lookup'
import type { DishSource } from './dishes'

// What adding and editing a Dish accept from the client, shared by both.

const webLinkInput = z.url({ protocol: /^https?$/ }).max(2048)

const dishTitle = z.string().trim().min(1).max(200)

// Optional; a blank note is no note.
export const dishNote = z.string().trim().max(2000).nullish().transform(note => note || null)

// Who published the Source (CONTEXT.md: Creator), as Source Lookup found it
// or a Member typed it. Optional; a blank one is none.
const dishCreator = z.string().trim().max(100).nullish().transform(creator => creator || null)

// The canonical link and kind from Source Lookup. The kind is read from the
// link itself; the one sent only tells a blog from any other web page.
const sourceInput = z.object({ link: webLinkInput, kind: z.enum(SOURCE_KINDS).optional() })
export type SourceInput = z.infer<typeof sourceInput>

export function sourceOf(input: SourceInput): DishSource {
  const guess = guessSource(input.link)
  const isBlog = guess.kind === 'other' && input.kind === 'blog'
  return { link: guess.canonicalLink, kind: isBlog ? 'blog' : guess.kind }
}

// A Member's own photo ("Eigenes Foto") as POST /api/boards/:id/photos
// stored it: where it went, and the photo ticket it came with.
const photoInput = z.object({ url: z.string().min(1).max(2048), ticket: z.string().max(200) })

// Where a Source image or own photo is shifted to (shared/image-focus.ts):
// a point within the image, kept in whole percent.
const percent = z.number().min(0).max(100).transform(Math.round)
const imageFocusInput = z.object({ x: percent, y: percent })

// Adding a Dish (POST /api/boards/:id/dishes).
export const addDishBody = z.object({
  title: dishTitle,
  note: dishNote,
  // Its Placeholder Image, shown if there is no Source image.
  placeholder: z.enum(PLACEHOLDERS),
  source: sourceInput.nullish(),
  creator: dishCreator,
  // The Source image Source Lookup found (third-party) and the Image Ticket it
  // came with; copied on save, but only with a valid ticket.
  imageUrl: webLinkInput.nullish(),
  imageTicket: z.string().max(200).nullish(),
  // Or the Member's own photo, used instead of any Source image.
  photo: photoInput.nullish(),
  // Its focus point; left out, or without an image, the centre.
  imageFocus: imageFocusInput.optional(),
})
export type AddDishBody = z.input<typeof addDishBody>

// Changes to a Dish (PATCH /api/dishes/:id); only the fields sent change.
export const dishEditBody = z.object({
  title: dishTitle.optional(),
  note: dishNote.optional(),
  // Null removes the Source. Changing it never changes the image.
  source: sourceInput.nullable().optional(),
  // Blank clears it. Changing the Source never changes it.
  creator: dishCreator.optional(),
  placeholder: z.enum(PLACEHOLDERS).optional(),
  // Null drops the stored image, so the Dish shows its Placeholder. A link is
  // the image "Bild neu laden" found (third-party) and needs the Image Ticket
  // it came with, as when adding a Dish.
  imageUrl: webLinkInput.nullable().optional(),
  imageTicket: z.string().max(200).nullish(),
  // The Member's own photo becomes the image, used instead of `imageUrl`.
  photo: photoInput.optional(),
  // Shifts the image. A new image (or the Placeholder) starts in the centre
  // unless this comes with it.
  imageFocus: imageFocusInput.optional(),
})
export type DishEditBody = z.input<typeof dishEditBody>
