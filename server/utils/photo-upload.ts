import type { H3Event } from 'h3'
import { PHOTO_MAX_BYTES, PHOTO_NOT_AN_IMAGE, PHOTO_TOO_LARGE } from '../../shared/photo'
import type { PhotoStore } from '../image-store/photo'

// An own photo's upload, the raw file as the request body: "Eigenes Foto"
// (POST /api/boards/:id/photos) and Profile Pictures (POST /api/me/pictures)
// alike. Stored by `store` (checked by content, scaled down, metadata
// stripped), it answers where it went. Refused: 413 over the size limit, 411
// without a Content-Length, 415 for anything that isn't a JPEG, PNG, WebP or
// HEIC photo; 429 over the user's upload limit, shared by both
// (server/rate-limits.ts); 502 if storing it failed.
export async function storeUploadedPhoto(event: H3Event, userId: string, store: PhotoStore): Promise<string> {
  // Refused before reading: browsers announce a file's size, so a body
  // without one (chunked) isn't read at all.
  const tooLarge = () => createError({ statusCode: PHOTO_TOO_LARGE, statusMessage: 'Photo too large' })
  const length = getRequestHeader(event, 'content-length') ?? ''
  if (!/^\d+$/.test(length)) throw createError({ statusCode: 411, statusMessage: 'Length required' })
  if (Number(length) > PHOTO_MAX_BYTES) throw tooLarge()
  await spendRateLimit(userId, 'upload')
  const bytes = await readRawBody(event, false) ?? new Uint8Array()

  const stored = await store(bytes)
  if (!stored.ok) {
    if (stored.refusal === 'too-large') throw tooLarge()
    if (stored.refusal === 'not-an-image') throw createError({ statusCode: PHOTO_NOT_AN_IMAGE, statusMessage: 'Not a photo' })
    throw createError({ statusCode: 502, statusMessage: 'Photo not stored' })
  }
  return stored.url
}
