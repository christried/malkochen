import { ref } from 'vue'
// Relative imports, not `~~`: the module's tests run in plain Node (the
// "client" Vitest project), which knows no Nuxt aliases.
import { PHOTO_MAX_BYTES, PHOTO_NOT_AN_IMAGE, PHOTO_TOO_LARGE } from '../../shared/photo'

// "Eigenes Foto" on the client: uploads a picked photo to the Board
// (POST /api/boards/:id/photos) and answers where it was stored, with the
// photo ticket a Dish needs to take it. The server checks, scales and cleans
// the photo; here only the size limit is checked early, and a photo too
// large to send is made smaller first. Plain Vue reactivity; the upload and
// the shrinking are replaced with fakes in the tests, so it runs in Node.

export interface UploadedPhoto { url: string, ticket: string }

// Why a photo wasn't taken, as the Member is told.
export type PhotoProblem = 'too-large' | 'not-an-image' | 'failed'

// Sends the photo; rejects with the HTTP status code ($fetch's statusCode)
// if refused.
export type SendPhoto = (boardId: string, body: Blob) => Promise<UploadedPhoto>
// The photo made smaller, or null if the browser can't read it (HEIC, or no
// image at all).
export type ShrinkPhoto = (photo: Blob) => Promise<Blob | null>

// Vercel refuses request bodies above 4.5 MB, below our own limit: a larger
// photo is sent shrunk, as a JPEG of at most SHRINK_SIDE.
const SEND_LIMIT = 4_000_000
const SHRINK_SIDE = 2400

function sendPhoto(boardId: string, body: Blob): Promise<UploadedPhoto> {
  return $fetch<UploadedPhoto>(`/api/boards/${boardId}/photos`, {
    method: 'POST',
    body,
    headers: { 'content-type': body.type || 'application/octet-stream' },
  })
}

// Drawn onto a canvas, which keeps none of the file's metadata. The
// browser turns it upright on the way (EXIF orientation).
async function shrinkPhoto(photo: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(photo)
    const scale = Math.min(1, SHRINK_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  }
  catch {
    return null
  }
}

function problemOf(error: unknown): PhotoProblem {
  const code = (error as { statusCode?: number } | null)?.statusCode
  if (code === PHOTO_TOO_LARGE) return 'too-large'
  if (code === PHOTO_NOT_AN_IMAGE) return 'not-an-image'
  return 'failed'
}

export function usePhotoUpload(send: SendPhoto = sendPhoto, shrink: ShrinkPhoto = shrinkPhoto) {
  const uploading = ref(false)
  const problem = ref<PhotoProblem | null>(null)
  // Counts the picks; only the latest one's answer counts.
  let latest = 0

  // The stored photo, or null if it was refused, failed, or a later pick
  // came first.
  async function upload(boardId: string, photo: Blob): Promise<UploadedPhoto | null> {
    const run = ++latest
    problem.value = null
    if (photo.size > PHOTO_MAX_BYTES) {
      uploading.value = false
      problem.value = 'too-large'
      return null
    }
    uploading.value = true
    try {
      const body = photo.size > SEND_LIMIT ? await shrink(photo) ?? photo : photo
      const stored = await send(boardId, body)
      return run === latest ? stored : null
    }
    catch (error) {
      if (run === latest) problem.value = problemOf(error)
      return null
    }
    finally {
      if (run === latest) uploading.value = false
    }
  }

  // Forgets the last problem (the dialog opens afresh).
  function reset() {
    latest++
    uploading.value = false
    problem.value = null
  }

  return { upload, uploading, problem, reset }
}
