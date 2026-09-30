import { resolve } from 'node:path'
import { blobStorage, createImageStore, diskStorage, type ImageStore } from '../image-store'
import { parseServerEnv } from '../env'

const { BLOB_READ_WRITE_TOKEN } = parseServerEnv(process.env)

// The app's one Image Store: Vercel Blob when a token is set (always, in
// deployed environments), otherwise the disk (local dev and tests).
export const IMAGE_DIR = resolve('.data/images')

export const copyImage: ImageStore = createImageStore({
  storage: BLOB_READ_WRITE_TOKEN ? blobStorage(BLOB_READ_WRITE_TOKEN) : diskStorage(IMAGE_DIR),
})
