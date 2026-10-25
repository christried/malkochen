import { dishEditBody, sourceOf } from '../../utils/dish-input'
import { boardOfDish, editDish, membersDish, type SavedDish } from '../../utils/dishes'
import { storeDishImage } from '../../utils/image-store'
import { checkedCaption } from '../../utils/source-ticket'

// PATCH /api/dishes/:id — edits a Dish from its detail. Only the fields sent
// change. A reloaded image is copied into the Image Store; if that fails, the
// Dish keeps the image it had and the answer carries `imageNotStored: true`.
// So does a Member's own photo whose ticket isn't valid. A new image starts
// in the centre unless its focus point (`imageFocus`) comes with it.
export default defineEventHandler(async (event): Promise<SavedDish> => {
  const dishId = dishIdParam(event)
  const parsed = dishEditBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Invalid Dish changes' })
  const user = requireUser(event)
  // Anyone's Dish with "edit Dishes", else only one the user added.
  await requireDishPermission(dishId, user.id, 'editDishes')
  const { source, caption, sourceTicket, imageUrl, imageTicket, photo, imageFocus, ...rest } = parsed.data
  // A reloaded image costs what adding a Dish from a link does.
  if (imageUrl) await spendRateLimit(user.id, 'add-dish')
  // Not copied for a non-Member or a missing Dish, which editDish then refuses.
  const { stored, refused } = await storeDishImage(user.id, () => boardOfDish(dishId), { photo, imageUrl, imageTicket })
  // The Caption is read from the Source's link: it changes only when the link
  // does. The same link keeps the Caption the Dish has, whatever is sent with it.
  const newSource = source ? sourceOf(source) : null
  const current = source ? await membersDish(dishId, user.id) : null
  // A removed Source (null) has no link to match: its Caption goes.
  const linkChanged = source !== undefined && (!newSource || newSource.link !== current?.source?.link)
  const edited = await editDish(dishId, user.id, {
    ...rest,
    ...source !== undefined && { source: newSource },
    // A new link keeps the Caption only with the Source Ticket Source Lookup
    // signed for it; a removed Source takes its Caption with it.
    ...linkChanged && {
      caption: newSource ? checkedCaption(user.id, { link: newSource.link, caption: caption ?? null, ticket: sourceTicket }) : null,
    },
    // Null (and no photo) drops the image, for the Placeholder; a new image
    // that couldn't be stored leaves it as it was.
    ...((imageUrl === null && !photo) || stored) && { imageUrl: stored },
    // Where the image is shifted to, unless it is for a new image that
    // couldn't be stored: the one the Dish keeps stays as it was.
    ...!refused && imageFocus && { imageFocus },
  })
  if (!edited) throw dishNotFound()
  return refused ? { ...edited, imageNotStored: true } : edited
})
