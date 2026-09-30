import { z } from 'zod'
import { PLACEHOLDERS } from '../../../shared/placeholders'
import { dishNote, dishTitle, sourceInput, sourceOf, webLink } from '../../utils/dish-input'
import { editDish, isDishMember, type SavedDish } from '../../utils/dishes'
import { storeFoundImage } from '../../utils/image-store'

const body = z.object({
  title: dishTitle.optional(),
  note: dishNote.optional(),
  // Null removes the Source. Changing it never changes the image.
  source: sourceInput.nullable().optional(),
  placeholder: z.enum(PLACEHOLDERS).optional(),
  // Null drops the stored image, so the Dish shows its Placeholder. A link is
  // the image "Bild neu laden" found (third-party) and needs the Image Ticket
  // it came with, as when adding a Dish.
  imageUrl: webLink.nullable().optional(),
  imageTicket: z.string().max(200).nullish(),
})

// PATCH /api/dishes/:id — edits a Dish from its detail. Only the fields sent
// change. A reloaded image is copied into the Image Store; if that fails, the
// Dish keeps the image it had and the answer carries `imageNotStored: true`.
export default defineEventHandler(async (event): Promise<SavedDish> => {
  const dishId = dishIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Dish changes' })
  const user = requireUser(event)
  const { source, imageUrl, imageTicket, ...rest } = parsed.data
  // Before copying anything: non-Members must not fill our storage.
  if (imageUrl && !await isDishMember(dishId, user.id)) throw dishNotFound()

  const stored = imageUrl ? await storeFoundImage(user.id, imageUrl, imageTicket) : null
  const edited = await editDish(dishId, user.id, {
    ...rest,
    ...source !== undefined && { source: source && sourceOf(source) },
    // A reloaded image that couldn't be stored leaves the image as it was.
    ...(imageUrl === null || stored) && { imageUrl: stored },
  })
  if (!edited) throw dishNotFound()
  return imageUrl && !stored ? { ...edited, imageNotStored: true } : edited
})
