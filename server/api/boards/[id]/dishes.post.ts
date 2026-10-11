import { addDishBody, sourceOf } from '../../../utils/dish-input'
import { addDish, type AddedDish } from '../../../utils/dishes'
import { storeDishImage } from '../../../utils/image-store'

// POST /api/boards/:id/dishes — adds a Dish at the top of the Board's first
// Column: from a link (Source and Source image), or without one ("Ohne Link
// hinzufügen"), and answers it placed (AddedDish). The Source image is
// copied into the Image Store; if that fails (or its Image Ticket is not
// valid), the Dish keeps its Placeholder Image and the answer carries
// `imageNotStored: true`, so the Member is told. A Member's own photo,
// already stored by the upload, is used instead, if its ticket is valid.
export default defineEventHandler(async (event): Promise<AddedDish> => {
  const boardId = boardIdParam(event)
  const parsed = addDishBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A title and a Placeholder Image are required' })
  const user = requireUser(event)
  await spendRateLimit(user.id, 'add-dish')
  const { source, imageUrl, imageTicket, photo, ...rest } = parsed.data
  // Not copied for a non-Member, whom addDish then refuses.
  const { stored, refused } = await storeDishImage(user.id, async () => boardId, { photo, imageUrl, imageTicket })
  const created = await addDish(boardId, user, {
    ...rest,
    source: source ? sourceOf(source) : null,
    imageUrl: stored,
  })
  if (!created) throw boardNotFound()
  setResponseStatus(event, 201)
  return refused ? { ...created, imageNotStored: true } : created
})
