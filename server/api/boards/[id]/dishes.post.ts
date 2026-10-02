import { z } from 'zod'
import { PLACEHOLDERS } from '../../../../shared/placeholders'
import { dishNote, dishTitle, sourceInput, sourceOf, webLinkInput } from '../../../utils/dish-input'
import { addDish, type SavedDish } from '../../../utils/dishes'
import { storeFoundImage } from '../../../utils/image-store'

const body = z.object({
  title: dishTitle,
  note: dishNote,
  // The fallback image, and the image if there is no Source image.
  placeholder: z.enum(PLACEHOLDERS),
  source: sourceInput.nullish(),
  // The Source image Source Lookup found (third-party) and the Image Ticket it
  // came with; copied on save, but only with a valid ticket.
  imageUrl: webLinkInput.nullish(),
  imageTicket: z.string().max(200).nullish(),
})

// POST /api/boards/:id/dishes — adds a Dish at the top of the Board's first
// Column: from a link (Source and Source image), or without one ("Ohne Link
// hinzufügen"). The Source image is copied into the Image Store; if that
// fails (or its Image Ticket is not valid), the Dish keeps its Placeholder
// Image and the answer carries `imageNotStored: true`, so the Member is told.
export default defineEventHandler(async (event): Promise<SavedDish> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A title and a Placeholder Image are required' })
  const user = requireUser(event)
  const { source, imageUrl, imageTicket, ...rest } = parsed.data
  // Not stored for a non-Member, whom addDish then refuses.
  const stored = imageUrl ? await storeFoundImage(user.id, boardId, imageUrl, imageTicket) : null
  const created = await addDish(boardId, user, {
    ...rest,
    source: source ? sourceOf(source) : null,
    imageUrl: stored,
  })
  if (!created) throw boardNotFound()
  setResponseStatus(event, 201)
  return imageUrl && !stored ? { ...created, imageNotStored: true } : created
})
