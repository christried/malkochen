import { z } from 'zod'
import { PLACEHOLDERS } from '../../../../shared/placeholders'
import { isMember } from '../../../utils/boards'
import { dishNote, dishTitle, sourceInput, sourceOf, webLink } from '../../../utils/dish-input'
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
  imageUrl: webLink.nullish(),
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
  // Before copying anything: non-Members must not fill our storage.
  if (!await isMember(boardId, user.id)) throw boardNotFound()

  const { source, imageUrl, imageTicket, ...rest } = parsed.data
  const stored = imageUrl ? await storeFoundImage(user.id, imageUrl, imageTicket) : null
  const created = await addDish(boardId, user, {
    ...rest,
    source: source ? sourceOf(source) : null,
    imageUrl: stored,
  })
  if (!created) throw boardNotFound()
  setResponseStatus(event, 201)
  return imageUrl && !stored ? { ...created, imageNotStored: true } : created
})
