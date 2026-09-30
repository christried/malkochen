import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { IMAGE_TYPES } from '../../image-store'
import { IMAGE_DIR } from '../../utils/image-store'

// File extension → media type, the reverse of the Image Store's IMAGE_TYPES.
const CONTENT_TYPES = Object.fromEntries(Object.entries(IMAGE_TYPES).map(([type, extension]) => [extension, type]))
// Only names the Image Store itself writes: dishes/<uuid>.<extension>.
const NAME = /^dishes\/[0-9a-f-]{36}\.(\w+)$/

// GET /images/dishes/<uuid>.<ext> — images stored on disk, when there is no
// Vercel Blob token (local dev and tests). Deployed, stored images are Blob
// URLs and this route finds nothing.
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, 'name') ?? ''
  const extension = name.match(NAME)?.[1]
  if (!extension || !Object.hasOwn(CONTENT_TYPES, extension)) throw createError({ statusCode: 404 })

  const bytes = await readFile(join(IMAGE_DIR, name)).catch(() => null)
  if (!bytes) throw createError({ statusCode: 404 })
  setResponseHeaders(event, {
    'content-type': CONTENT_TYPES[extension]!,
    'x-content-type-options': 'nosniff',
    'cache-control': 'public, max-age=31536000, immutable',
  })
  return bytes
})
