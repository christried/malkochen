import { PHOTO_MAX_BYTES, PHOTO_NOT_AN_IMAGE, PHOTO_TOO_LARGE } from '../../../../shared/photo'
import { isMember } from '../../../utils/boards'
import { photoTickets, storePhoto } from '../../../utils/image-store'

// POST /api/boards/:id/photos — "Eigenes Foto": a Member's own photo, the raw
// file as the request body. Stored (checked by content, scaled down, its
// metadata stripped), it answers where it went and a photo ticket; adding or
// editing a Dish with both makes it the Dish's image. Only for a Member of
// the Board, so nobody else fills our storage. Refused: 413 over the size
// limit, 411 without a Content-Length, 415 for anything that isn't a JPEG, PNG, WebP or HEIC photo.
export default defineEventHandler(async (event): Promise<{ url: string, ticket: string }> => {
  const boardId = boardIdParam(event)
  const user = requireUser(event)
  if (!await isMember(boardId, user.id)) throw boardNotFound()

  // Refused before reading: browsers announce a file's size, so a body
  // without one (chunked) isn't read at all.
  const tooLarge = () => createError({ statusCode: PHOTO_TOO_LARGE, statusMessage: 'Photo too large' })
  const length = getRequestHeader(event, 'content-length')
  if (!length) throw createError({ statusCode: 411, statusMessage: 'Length required' })
  if (Number(length) > PHOTO_MAX_BYTES) throw tooLarge()
  const bytes = await readRawBody(event, false) ?? new Uint8Array()

  const stored = await storePhoto(bytes)
  if (!stored.ok) {
    if (stored.refusal === 'too-large') throw tooLarge()
    if (stored.refusal === 'not-an-image') throw createError({ statusCode: PHOTO_NOT_AN_IMAGE, statusMessage: 'Not a photo' })
    throw createError({ statusCode: 502, statusMessage: 'Photo not stored' })
  }
  setResponseStatus(event, 201)
  return { url: stored.url, ticket: photoTickets.issue(user.id, stored.url) }
})
