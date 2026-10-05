import { dishEditBody, sourceOf } from '../../utils/dish-input'
import { boardOfDish, editDish, type SavedDish } from '../../utils/dishes'
import { storeDishImage } from '../../utils/image-store'

// PATCH /api/dishes/:id — edits a Dish from its detail. Only the fields sent
// change. A reloaded image is copied into the Image Store; if that fails, the
// Dish keeps the image it had and the answer carries `imageNotStored: true`.
// So does a Member's own photo whose ticket isn't valid.
export default defineEventHandler(async (event): Promise<SavedDish> => {
  const dishId = dishIdParam(event)
  const parsed = dishEditBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Dish changes' })
  const user = requireUser(event)
  const { source, imageUrl, imageTicket, photo, ...rest } = parsed.data
  // Not copied for a non-Member or a missing Dish, which editDish then refuses.
  const { stored, refused } = await storeDishImage(user.id, () => boardOfDish(dishId), { photo, imageUrl, imageTicket })
  const edited = await editDish(dishId, user.id, {
    ...rest,
    ...source !== undefined && { source: source && sourceOf(source) },
    // Null (and no photo) drops the image, for the Placeholder; a new image
    // that couldn't be stored leaves it as it was.
    ...((imageUrl === null && !photo) || stored) && { imageUrl: stored },
  })
  if (!edited) throw dishNotFound()
  return refused ? { ...edited, imageNotStored: true } : edited
})
