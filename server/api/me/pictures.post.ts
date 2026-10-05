import { PHOTO_MAX_BYTES, PHOTO_NOT_AN_IMAGE, PHOTO_TOO_LARGE } from '../../../shared/photo'
import { pictureTickets, storePicture } from '../../utils/image-store'

// POST /api/me/pictures — uploads a Profile Picture, the raw file as the
// request body, under the same rules as "Eigenes Foto" (checked by content,
// scaled down, metadata stripped), but cut square. It answers where it went
// and a picture ticket; nothing changes until PUT /api/me/picture takes them,
// so the user sees it in a preview first. Refused: 413 over the size limit,
// 411 without a Content-Length, 415 for anything that isn't a JPEG, PNG,
// WebP or HEIC photo.
export default defineEventHandler(async (event): Promise<{ url: string, ticket: string }> => {
  const user = requireUser(event)

  // Refused before reading: browsers announce a file's size, so a body
  // without one (chunked) isn't read at all.
  const tooLarge = () => createError({ statusCode: PHOTO_TOO_LARGE, statusMessage: 'Picture too large' })
  const length = getRequestHeader(event, 'content-length')
  if (!length) throw createError({ statusCode: 411, statusMessage: 'Length required' })
  if (Number(length) > PHOTO_MAX_BYTES) throw tooLarge()
  const bytes = await readRawBody(event, false) ?? new Uint8Array()

  const stored = await storePicture(bytes)
  if (!stored.ok) {
    if (stored.refusal === 'too-large') throw tooLarge()
    if (stored.refusal === 'not-an-image') throw createError({ statusCode: PHOTO_NOT_AN_IMAGE, statusMessage: 'Not a photo' })
    throw createError({ statusCode: 502, statusMessage: 'Picture not stored' })
  }
  setResponseStatus(event, 201)
  return { url: stored.url, ticket: pictureTickets.issue(user.id, stored.url) }
})
