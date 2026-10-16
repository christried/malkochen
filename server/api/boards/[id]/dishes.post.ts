import { addDishBody, sourceOf } from '../../../utils/dish-input'
import { addDish, type AddedDish } from '../../../utils/dishes'
import { storeDishImage } from '../../../utils/image-store'
import { notifyNewDish } from '../../../utils/push'

// POST /api/boards/:id/dishes — adds a Dish at the top of the Board's first
// Column: from a link (Source and Source image), or without one ("Ohne Link
// hinzufügen"), and answers it placed (AddedDish). The Source image is
// copied into the Image Store; if that fails (or its Image Ticket is not
// valid), the Dish keeps its Placeholder Image and the answer carries
// `imageNotStored: true`, so the Member is told. A Member's own photo,
// already stored by the upload, is used instead, if its ticket is valid.
// The Board's other Members who turned push notifications on are notified
// before the answer (a serverless function may stop right after it); that
// never fails the request. Not for a Dish added during the Tour (ADR 0006),
// which may be deleted again seconds later.
export default defineEventHandler(async (event): Promise<AddedDish> => {
  const boardId = boardIdParam(event)
  const parsed = addDishBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A title and a Placeholder Image are required' })
  const user = requireUser(event)
  await spendRateLimit(user.id, 'add-dish')
  const { source, imageUrl, imageTicket, photo, tour, ...rest } = parsed.data
  // Not copied for a non-Member, whom addDish then refuses.
  const { stored, refused } = await storeDishImage(user.id, async () => boardId, { photo, imageUrl, imageTicket })
  const created = await addDish(boardId, user, {
    ...rest,
    source: source ? sourceOf(source) : null,
    imageUrl: stored,
  })
  if (!created) throw boardNotFound()
  if (!tour) await notifyNewDish(boardId, created.id, user.id)
  setResponseStatus(event, 201)
  return refused ? { ...created, imageNotStored: true } : created
})
