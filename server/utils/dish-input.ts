import { z } from 'zod'
import { PLACEHOLDERS } from '../../shared/placeholders'
import { captionOf, guessSource, SOURCE_KINDS } from '../source-lookup'
import type { DishSource } from './dishes'

// What adding and editing a Dish accept from the client, shared by both.

const webLinkInput = z.url({ protocol: /^https?$/ }).max(2048)

const dishTitle = z.string().trim().min(1).max(200)

// Who published the Source (CONTEXT.md: Creator), as Source Lookup found it
// or a Member typed it. Optional; a blank one is none.
const dishCreator = z.string().trim().max(100).nullish().transform(creator => creator || null)

// The Caption (CONTEXT.md) as Source Lookup found it for the Source sent
// with it. Optional; blank or cut to a few thousand characters as Source
// Lookup keeps it.
const dishCaption = z.string().nullish().transform(caption => captionOf(caption))

// The Source Ticket that came with a Caption (server/utils/source-ticket.ts).
const sourceTicketInput = z.string().max(500).nullish()

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
  // Its Placeholder Image, shown if there is no Source image.
  placeholder: z.enum(PLACEHOLDERS),
  source: sourceInput.nullish(),
  creator: dishCreator,
  // The Caption of that Source, and the Source Ticket Source Lookup signed for
  // it: a Caption without a valid ticket is not kept (server/utils/source-ticket.ts).
  caption: dishCaption,
  sourceTicket: sourceTicketInput,
  // The Source image Source Lookup found (third-party) and the Image Ticket it
  // came with; copied on save, but only with a valid ticket.
  imageUrl: webLinkInput.nullish(),
  imageTicket: z.string().max(200).nullish(),
  // Or the Member's own photo, used instead of any Source image.
  photo: photoInput.nullish(),
  // Its focus point; left out, or without an image, the centre.
  imageFocus: imageFocusInput.optional(),
  // Added during the Tour (ADR 0006): the other Members get no Push
  // Notification for it; nothing else changes.
  tour: z.boolean().optional(),
})
export type AddDishBody = z.input<typeof addDishBody>

// Changes to a Dish (PATCH /api/dishes/:id); only the fields sent change.
export const dishEditBody = z.object({
  title: dishTitle.optional(),
  // Null removes the Source. Changing it never changes the image.
  source: sourceInput.nullable().optional(),
  // Blank clears it. Changing the Source never changes it.
  creator: dishCreator.optional(),
  // The Caption of the Source sent with it, and its Source Ticket; read only
  // when the Source's link changes (server/api/dishes/[id].patch.ts).
  caption: dishCaption.optional(),
  sourceTicket: sourceTicketInput.optional(),
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

// Several Dishes at once (POST /api/dishes/bulk, #218), each Dish once: a
// selection is a set.
const dishIds = z.array(z.uuid()).min(1).max(500).refine(ids => new Set(ids).size === ids.length)

export const bulkBody = z.discriminatedUnion('action', [
  // To the top of a Column.
  z.object({ action: z.literal('move'), dishIds, columnId: z.uuid() }),
  // Each back to its Column, at its index.
  z.object({
    action: z.literal('place'),
    places: z.array(z.object({ dishId: z.uuid(), columnId: z.uuid(), index: z.int().min(0).max(100_000) }))
      .min(1).max(500).refine(places => new Set(places.map(p => p.dishId)).size === places.length),
  }),
  z.object({ action: z.literal('delete'), dishIds }),
  z.object({ action: z.literal('restore'), dishIds }),
])
export type BulkBody = z.input<typeof bulkBody>
