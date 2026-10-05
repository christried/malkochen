import { resolve } from 'node:path'
import { blobStorage, createImageStore, diskStorage, type ImageStore } from '../image-store'
import { createFoundImageStore } from '../image-store/found-image'
import { createPhotoStore } from '../image-store/photo'
import { createImageTickets } from '../image-store/tickets'
import { parseServerEnv } from '../env'
import { isMember } from './boards'

const { BLOB_READ_WRITE_TOKEN, BETTER_AUTH_SECRET } = parseServerEnv(process.env)

// The app's one Image Store: Vercel Blob when a token is set (always, in
// deployed environments), otherwise the disk (local dev and tests).
export const IMAGE_DIR = resolve('.data/images')

// The Member only sees a notice; the reason goes to the runtime logs.
const logNotCopied = (imageUrl: string, reason: string) => console.warn(`[image-store] not copied: ${reason} (${imageUrl})`)

const storage = BLOB_READ_WRITE_TOKEN ? blobStorage(BLOB_READ_WRITE_TOKEN) : diskStorage(IMAGE_DIR)

export const copyImage: ImageStore = createImageStore({ storage, onFailure: logNotCopied })

// Signs the images Source Lookup finds, so only those are ever copied.
export const imageTickets = createImageTickets(BETTER_AUTH_SECRET)

// Stores the image Source Lookup found for a Dish on this Board, for creating
// and editing a Dish alike: the stored image's URL, or null if it wasn't stored.
export const storeFoundImage = createFoundImageStore({ isMember, copyImage, tickets: imageTickets, onRefused: logNotCopied })

// "Eigenes Foto": stores a Member's own photo (checked, scaled down and
// stripped of its metadata first), and signs where it went, so a Dish only
// ever takes a photo its Member uploaded.
export const storePhoto = createPhotoStore({ storage, onFailure: reason => console.warn(`[image-store] photo not stored: ${reason}`) })
export const photoTickets = createImageTickets(BETTER_AUTH_SECRET, { purpose: 'photo' })

// The uploaded photo a Dish is added or edited with, if its ticket is valid
// for this Member: its URL, else null.
export function checkedPhoto(userId: string, photo: { url: string, ticket: string }): string | null {
  return photoTickets.check(userId, photo.url, photo.ticket) ? photo.url : null
}
