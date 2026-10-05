import { pictureTickets, storePicture } from '../../utils/image-store'
import { storeUploadedPhoto } from '../../utils/photo-upload'

// POST /api/me/pictures — uploads a Profile Picture, the raw file as the
// request body, under the same rules as "Eigenes Foto" (server/utils/
// photo-upload.ts), but cut square. It answers where it went and a picture
// ticket; nothing changes until PUT /api/me/picture takes them, so the user
// sees it in a preview first.
export default defineEventHandler(async (event): Promise<{ url: string, ticket: string }> => {
  const user = requireUser(event)
  const url = await storeUploadedPhoto(event, storePicture)
  setResponseStatus(event, 201)
  return { url, ticket: pictureTickets.issue(user.id, url) }
})
