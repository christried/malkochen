import { dishEditBody, sourceOf } from '../../utils/dish-input'
import { boardOfDish, editDish, type SavedDish } from '../../utils/dishes'
import { storeFoundImage } from '../../utils/image-store'

// PATCH /api/dishes/:id — edits a Dish from its detail. Only the fields sent
// change. A reloaded image is copied into the Image Store; if that fails, the
// Dish keeps the image it had and the answer carries `imageNotStored: true`.
export default defineEventHandler(async (event): Promise<SavedDish> => {
  const dishId = dishIdParam(event)
  const parsed = dishEditBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Dish changes' })
  const user = requireUser(event)
  const { source, imageUrl, imageTicket, ...rest } = parsed.data
  // Not stored for a non-Member or a missing Dish, which editDish then refuses.
  const boardId = imageUrl ? await boardOfDish(dishId) : null
  const stored = imageUrl && boardId ? await storeFoundImage(user.id, boardId, imageUrl, imageTicket) : null
  const edited = await editDish(dishId, user.id, {
    ...rest,
    ...source !== undefined && { source: source && sourceOf(source) },
    // A reloaded image that couldn't be stored leaves the image as it was.
    ...(imageUrl === null || stored) && { imageUrl: stored },
  })
  if (!edited) throw dishNotFound()
  return imageUrl && !stored ? { ...edited, imageNotStored: true } : edited
})
