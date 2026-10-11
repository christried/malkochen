import { isMember } from '../../../utils/boards'
import { photoTickets, storePhoto } from '../../../utils/image-store'
import { storeUploadedPhoto } from '../../../utils/photo-upload'

// POST /api/boards/:id/photos — "Eigenes Foto": a Member's own photo, the raw
// file as the request body (server/utils/photo-upload.ts says what is
// refused). Stored, it answers where it went and a photo ticket; adding or
// editing a Dish with both makes it the Dish's image. Only for a Member of
// the Board, so nobody else fills our storage.
export default defineEventHandler(async (event): Promise<{ url: string, ticket: string }> => {
  const boardId = boardIdParam(event)
  const user = requireUser(event)
  if (!await isMember(boardId, user.id)) throw boardNotFound()

  const url = await storeUploadedPhoto(event, user.id, storePhoto)
  setResponseStatus(event, 201)
  return { url, ticket: photoTickets.issue(user.id, url) }
})
