import type { ImageStore } from '.'
import type { ImageTickets } from './tickets'

// Storing a found image for a Dish: the one way the image Source Lookup found
// gets into the Image Store, used by both creating and editing a Dish. Nothing
// is copied for a Board the user isn't a Member of (non-Members must not fill
// our storage), nor without the image's valid Image Ticket.

// The stored image's URL, or null if it wasn't stored. Never rejects for a
// refused or failed copy; the write itself still refuses a non-Member.
export type StoreFoundImage = (
  userId: string,
  boardId: string,
  imageUrl: string,
  imageTicket: string | null | undefined,
) => Promise<string | null>

export interface FoundImageOptions {
  isMember: (boardId: string, userId: string) => Promise<boolean>
  copyImage: ImageStore
  tickets: ImageTickets
  // Told why an image wasn't copied; the answer itself is still just null.
  onRefused?: (imageUrl: string, reason: string) => void
}

export function createFoundImageStore({ isMember, copyImage, tickets, onRefused }: FoundImageOptions): StoreFoundImage {
  const refuse = (imageUrl: string, reason: string) => {
    onRefused?.(imageUrl, reason)
    return null
  }

  return async (userId, boardId, imageUrl, imageTicket) => {
    // Before copying anything.
    if (!await isMember(boardId, userId)) return refuse(imageUrl, 'not a Member of the Board')
    if (!imageTicket || !tickets.check(userId, imageUrl, imageTicket)) return refuse(imageUrl, 'no valid Image Ticket')
    return copyImage(imageUrl)
  }
}
