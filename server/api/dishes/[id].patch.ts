import { dishEditBody, sourceOf } from '../../utils/dish-input'
import { boardOfDish, editDish, type SavedDish } from '../../utils/dishes'
import { checkedPhoto, storeFoundImage } from '../../utils/image-store'

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
  // The new image, if one is asked for: the Member's own photo (stored by its
  // upload, so only its ticket is checked) or a reloaded Source image (copied
  // now, but not for a non-Member or a missing Dish, which editDish then
  // refuses). Null asks for none: the Placeholder.
  const wanted = photo ?? imageUrl
  let stored: string | null = null
  if (photo) stored = checkedPhoto(user.id, photo)
  else if (imageUrl) {
    const boardId = await boardOfDish(dishId)
    stored = boardId && await storeFoundImage(user.id, boardId, imageUrl, imageTicket)
  }
  const edited = await editDish(dishId, user.id, {
    ...rest,
    ...source !== undefined && { source: source && sourceOf(source) },
    // A new image that couldn't be stored leaves the image as it was.
    ...(wanted === null || stored) && { imageUrl: stored },
  })
  if (!edited) throw dishNotFound()
  return wanted && !stored ? { ...edited, imageNotStored: true } : edited
})
