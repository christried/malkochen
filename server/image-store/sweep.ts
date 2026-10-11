import { IMAGE_FOLDERS, type SweptStorage } from '.'

// The daily sweep (#195): deletes every stored image nothing refers to any
// more -- replaced or removed ones, those of purged Dishes and deleted
// Boards, and preview uploads never saved. One stored less than a day ago is
// kept even so: it may be a preview a Member is still deciding on (its
// ticket lasts an hour, tickets.ts).
const MIN_AGE_MS = 24 * 60 * 60 * 1000

export interface SweepOptions {
  storage: SweptStorage
  // Whether a Dish or a user still refers to the image at this URL.
  isReferenced: (url: string) => boolean
  // How many images are referenced at all. If some are, yet no stored image
  // is among them, the references and the storage disagree on what a URL
  // looks like; every image would look unreferenced, so the sweep refuses
  // instead of deleting them all.
  referenceCount?: number
  now?: Date
}

// Answers the URLs it deleted.
export async function sweepImages({ storage, isReferenced, referenceCount = 0, now = new Date() }: SweepOptions): Promise<string[]> {
  const cutoff = now.getTime() - MIN_AGE_MS
  const stored = (await Promise.all(IMAGE_FOLDERS.map(folder => storage.list(folder)))).flat()
  if (referenceCount > 0 && stored.length > 0 && !stored.some(image => isReferenced(image.url))) {
    throw new Error(`${referenceCount} images are referenced, but no stored image is one of them; nothing deleted`)
  }
  const unreferenced = stored
    .filter(image => image.uploadedAt.getTime() < cutoff && !isReferenced(image.url))
    .map(image => image.url)
  if (unreferenced.length) await storage.remove(unreferenced)
  return unreferenced
}
