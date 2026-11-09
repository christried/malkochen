import { addDishBody, sourceOf } from '../../../utils/dish-input'
import { addDish, dishIdStanding, placedDish, type AddedDish } from '../../../utils/dishes'
import { storeDishImage } from '../../../utils/image-store'
import { isUniqueViolation } from '../../../utils/late-changes'
import { notifyNewDish } from '../../../utils/push'
import { storedSourceFacts } from '../../../utils/source-ticket'

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
// Added offline, it comes with the id the device made for it (ADR 0012): a
// repeat of that id (its answer was lost) adds, stores and notifies nothing
// again and answers the Dish placed where it is now; an id another user's
// or another Board's Dish has is refused (409).
export default defineEventHandler(async (event): Promise<AddedDish> => {
  const boardId = boardIdParam(event)
  const parsed = addDishBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A title and a Placeholder Image are required' })
  const user = requireUser(event)
  // Before anything is stored or counted: a Member without "add Dishes"
  // gets 403, with or without a link, from the share target too.
  await requirePermission(boardId, user.id, 'addDishes')
  const { source, caption, playableVideo, sourceTicket, imageUrl, imageTicket, photo, tour, id, ...rest } = parsed.data
  const repeat = await repeated(id, boardId, user.id)
  if (repeat) {
    setResponseStatus(event, 201)
    return repeat
  }
  await spendRateLimit(user.id, 'add-dish')
  // Not copied for a non-Member, whom addDish then refuses.
  const { stored, refused } = await storeDishImage(user.id, async () => boardId, { photo, imageUrl, imageTicket })
  const storedSource = source ? sourceOf(source) : null
  let created: AddedDish | null
  try {
    created = await addDish(boardId, user, {
      ...rest,
      source: storedSource,
      // The Caption belongs to the Source, and is kept only with the Source
      // Ticket Source Lookup signed for it: none without one. So is whether an
      // Instagram post has a video that plays; TikTok and YouTube Shorts tell
      // from their link alone.
      ...storedSourceFacts(user.id, storedSource, { caption: caption ?? null, playableVideo, ticket: sourceTicket }),
      imageUrl: stored,
      imageIsOwnPhoto: Boolean(photo) && stored !== null,
    }, { tour, id })
  }
  catch (err) {
    // A repeat that arrived at the same moment added it first.
    const first = isUniqueViolation(err) ? await repeated(id, boardId, user.id) : null
    if (!first) throw err
    setResponseStatus(event, 201)
    return first
  }
  if (!created) throw boardNotFound()
  if (!tour) await notifyNewDish(boardId, created.id, user.id)
  setResponseStatus(event, 201)
  return refused ? { ...created, imageNotStored: true } : created
})

// The Dish a repeat of adding it (the same device-made id, late-changes.ts)
// answers with: placed where it is now. Null for a Dish not added yet (or
// none without an id). Throws 409 for an id another user's or another
// Board's Dish has, and 404 for one archived since.
async function repeated(id: string | undefined, boardId: string, userId: string): Promise<AddedDish | null> {
  if (!id) return null
  const standing = await dishIdStanding(id, boardId, userId)
  if (standing === 'taken') throw idTaken()
  if (standing === 'free') return null
  const placed = await placedDish(id, userId)
  if (!placed) throw dishNotFound()
  return placed
}
