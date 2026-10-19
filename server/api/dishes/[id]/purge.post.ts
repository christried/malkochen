import { removeImageIfUnreferenced } from '../../../utils/cleanup'
import { purgeDish } from '../../../utils/dishes'

// POST /api/dishes/:id/purge — "Endgültig löschen" in the Board's Archive:
// the Owner deletes an Archived Dish for good, and its image at once. Only
// an Archived Dish: one still on its Board is archived first.
export default defineEventHandler(async (event) => {
  const purged = await purgeDish(dishIdParam(event), requireUser(event).id)
  if (!purged) throw dishNotFound()
  if (purged === 'forbidden') throw createError({ statusCode: 403, statusMessage: 'Only the Owner can delete a Dish for good' })
  if (purged.imageUrl) {
    // The daily sweep still removes it if this fails.
    await removeImageIfUnreferenced(purged.imageUrl).catch(err => console.warn(`[image-store] not removed: ${err} (${purged.imageUrl})`))
  }
  setResponseStatus(event, 204)
  return null
})
