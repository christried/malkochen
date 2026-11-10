import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { blobStorage, createImageStore, diskStorage, IMAGE_TYPES, type ImageStore } from '../image-store'
import { createFoundImageStore } from '../image-store/found-image'
import { createPhotoStore, PICTURE_SIDE } from '../image-store/photo'
import { createImageTickets } from '../image-store/tickets'
import { parseServerEnv } from '../env'
import { fixtureImages } from '../source-lookup/fixtures'
import { publicFetch } from '../source-lookup/public-network'
import { lookupFixtures } from './source-lookup'
import { isMember } from './board-access'

const { BLOB_READ_WRITE_TOKEN, BETTER_AUTH_SECRET, IMAGE_DIR: imageDir } = parseServerEnv(process.env)

// The app's one Image Store: Vercel Blob when a token is set (always, in
// deployed environments), otherwise the disk (local dev and tests).
export const IMAGE_DIR = resolve(imageDir)

// The Member only sees a notice; the reason goes to the runtime logs.
const logNotCopied = (imageUrl: string, reason: string) => console.warn(`[image-store] not copied: ${reason} (${imageUrl})`)

export const storage = BLOB_READ_WRITE_TOKEN ? blobStorage(BLOB_READ_WRITE_TOKEN) : diskStorage(IMAGE_DIR)

export const copyImage: ImageStore = createImageStore({ storage, onFailure: logNotCopied, ...lookupFixtures && { fetch: fixtureImages(lookupFixtures, publicFetch) } })

// Signs the images Source Lookup finds, so only those are ever copied.
export const imageTickets = createImageTickets(BETTER_AUTH_SECRET)

// Stores the image Source Lookup found for a Dish on this Board, for creating
// and editing a Dish alike: the stored image's URL, or null if it wasn't stored.
const storeFoundImage = createFoundImageStore({ isMember, copyImage, tickets: imageTickets, onRefused: logNotCopied })

// "Eigenes Foto": stores a Member's own photo (checked, scaled down and
// stripped of its metadata first), and signs where it went, so a Dish only
// ever takes a photo its Member uploaded.
export const storePhoto = createPhotoStore({ storage, onFailure: reason => console.warn(`[image-store] photo not stored: ${reason}`) })
export const photoTickets = createImageTickets(BETTER_AUTH_SECRET, { purpose: 'photo' })

// A Profile Picture: stored the same way, but cut square, and signed for the
// user who uploaded it, so they only ever take their own.
export const storePicture = createPhotoStore({ storage, folder: 'pictures', square: PICTURE_SIDE, onFailure: reason => console.warn(`[image-store] picture not stored: ${reason}`) })
export const pictureTickets = createImageTickets(BETTER_AUTH_SECRET, { purpose: 'picture' })

// What Source Lookup read from a Source (its canonical link and Caption), signed
// for the Member who asked; see server/utils/source-ticket.ts.
export const sourceTickets = createImageTickets(BETTER_AUTH_SECRET, { purpose: 'source' })

export interface DishImageRequest {
  photo?: { url: string, ticket: string } | null
  imageUrl?: string | null
  imageTicket?: string | null
}

// The new image a Dish is added or edited with, for both: the Member's own
// photo (stored by its upload, so only its photo ticket is checked) or else
// the Source image Source Lookup found (copied now, and only for a Member of
// `boardOf()`'s Board). `stored`: its URL, or null; `refused`: one was asked
// for and isn't stored, so the Member is told.
export async function storeDishImage(
  userId: string,
  boardOf: () => Promise<string | null>,
  { photo, imageUrl, imageTicket }: DishImageRequest,
): Promise<{ stored: string | null, refused: boolean }> {
  let stored: string | null = null
  if (photo) {
    stored = photoTickets.check(userId, photo.url, photo.ticket) ? photo.url : null
    if (!stored) console.warn(`[image-store] photo not taken: no valid photo ticket (${photo.url})`)
  }
  else if (imageUrl) {
    const boardId = await boardOf()
    stored = boardId && await storeFoundImage(userId, boardId, imageUrl, imageTicket)
  }
  return { stored, refused: Boolean(photo || imageUrl) && !stored }
}

// A disk URL of a Dish image (diskStorage, served by server/routes/images).
const DISK_DISH_IMAGE = /^\/images\/(dishes\/[0-9a-f-]{36}\.(\w+))$/
// The media type of each stored image's extension: the reverse of IMAGE_TYPES.
const TYPE_OF_EXTENSION: Record<string, string> = Object.fromEntries(Object.entries(IMAGE_TYPES).map(([type, extension]) => [extension, type]))
const READ_TIMEOUT_MS = 5000

// The bytes and media type of a stored image (a Dish's, for a Snackbert
// Report, #424): read from disk for a disk URL, else fetched from the Blob
// URL the Image Store wrote. Null, logged, on any failure. Never rejects.
export async function readStoredImage(url: string): Promise<{ bytes: Uint8Array, type: string } | null> {
  const fail = (reason: string) => {
    console.warn(`[image-store] not read: ${reason} (${url})`)
    return null
  }
  try {
    const disk = DISK_DISH_IMAGE.exec(url)
    if (disk) {
      const type = TYPE_OF_EXTENSION[disk[2]!]
      if (!type) return fail('not an image type')
      return { bytes: new Uint8Array(await readFile(join(IMAGE_DIR, disk[1]!))), type }
    }
    const type = TYPE_OF_EXTENSION[new URL(url).pathname.split('.').pop() ?? '']
    if (!type) return fail('not an image type')
    const res = await fetch(url, { signal: AbortSignal.timeout(READ_TIMEOUT_MS) })
    if (!res.ok) return fail(`answered ${res.status}`)
    return { bytes: new Uint8Array(await res.arrayBuffer()), type }
  }
  catch (error) {
    return fail((error as NodeJS.ErrnoException).code ?? (error instanceof Error ? error.name : 'error'))
  }
}
