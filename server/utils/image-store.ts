import { resolve } from 'node:path'
import { blobStorage, createImageStore, diskStorage, type ImageStore } from '../image-store'
import { createImageTickets } from '../image-store/tickets'
import { parseServerEnv } from '../env'

const { BLOB_READ_WRITE_TOKEN, BETTER_AUTH_SECRET } = parseServerEnv(process.env)

// The app's one Image Store: Vercel Blob when a token is set (always, in
// deployed environments), otherwise the disk (local dev and tests).
export const IMAGE_DIR = resolve('.data/images')

export const copyImage: ImageStore = createImageStore({
  storage: BLOB_READ_WRITE_TOKEN ? blobStorage(BLOB_READ_WRITE_TOKEN) : diskStorage(IMAGE_DIR),
  // The Member only sees a notice; the reason goes to the runtime logs.
  onFailure: (imageUrl, reason) => console.warn(`[image-store] not copied: ${reason} (${imageUrl})`),
})

// Signs the images Source Lookup finds, so only those are ever copied.
export const imageTickets = createImageTickets(BETTER_AUTH_SECRET)

// Stores a Source image Source Lookup found for this user: copied only with
// its valid Image Ticket. The stored image's URL, or null if it wasn't stored.
export async function storeFoundImage(userId: string, imageUrl: string, imageTicket: string | null | undefined): Promise<string | null> {
  if (!imageTicket || !imageTickets.check(userId, imageUrl, imageTicket)) {
    console.warn(`[image-store] not copied: no valid Image Ticket (${imageUrl})`)
    return null
  }
  return copyImage(imageUrl)
}
