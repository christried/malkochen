import { purgeBoard } from '../../../utils/archived-boards'
import { removeImageIfUnreferenced } from '../../../utils/cleanup'

// POST /api/boards/:id/purge — "Endgültig löschen" under "Archiv" in the
// Board Switcher: the Owner deletes an Archived Board for good, and its
// images at once. Anyone else, and a Board that isn't archived, gets
// "not found".
export default defineEventHandler(async (event) => {
  const purged = await purgeBoard(boardIdParam(event), requireUser(event).id)
  if (!purged) throw boardNotFound()
  for (const url of purged.imageUrls) {
    // The daily sweep still removes it if this fails.
    await removeImageIfUnreferenced(url).catch(err => console.warn(`[image-store] not removed: ${err} (${url})`))
  }
  setResponseStatus(event, 204)
  return null
})
