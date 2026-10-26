import { createHmac, timingSafeEqual } from 'node:crypto'

// Image Tickets: GET /api/source-lookup signs each image it finds for the
// Member who asked, and saving a Dish copies an image only with a valid
// ticket. So the Image Store only ever copies what Source Lookup found, never
// an arbitrary URL a client sends. Uploading an own photo ("Eigenes Foto")
// signs the stored photo the same way, with tickets of their own purpose, and
// so does uploading a Profile Picture. Source Lookup also signs what it read
// from the Source (its canonical link and Caption) as a Source Ticket, so a
// Dish stores only what Source Lookup found.

export interface ImageTickets {
  issue: (userId: string, imageUrl: string) => string
  check: (userId: string, imageUrl: string, ticket: string) => boolean
}

export interface ImageTicketOptions {
  // How long a ticket stays valid: long enough for a Member to type a title.
  ttlMs?: number
  now?: () => number
  // What the ticket is for: by default a found image (Source Lookup's),
  // 'photo', a Member's own photo the upload stored, or 'picture', a Profile
  // Picture the upload stored, or 'source', what Source Lookup read from a
  // Source. A ticket is only ever valid for its own purpose.
  purpose?: 'found' | 'photo' | 'picture' | 'source'
}

export function createImageTickets(secret: string, options: ImageTicketOptions = {}): ImageTickets {
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000
  const now = options.now ?? Date.now
  // Its own key, so a ticket is never valid as anything else signed with the secret.
  const purpose = { found: 'malkochen image ticket', photo: 'malkochen photo ticket', picture: 'malkochen picture ticket', source: 'malkochen source ticket' }[options.purpose ?? 'found']
  const key = createHmac('sha256', secret).update(purpose).digest()
  const sign = (userId: string, imageUrl: string, expiresAt: string) =>
    createHmac('sha256', key).update(`${userId}\n${imageUrl}\n${expiresAt}`).digest()

  return {
    issue(userId, imageUrl) {
      const expiresAt = String(now() + ttlMs)
      return `${expiresAt}.${sign(userId, imageUrl, expiresAt).toString('base64url')}`
    },

    check(userId, imageUrl, ticket) {
      const [expiresAt = '', signature = '', ...rest] = ticket.split('.')
      if (rest.length || !/^\d+$/.test(expiresAt) || Number(expiresAt) < now()) return false
      const expected = sign(userId, imageUrl, expiresAt)
      const given = Buffer.from(signature, 'base64url')
      return given.length === expected.length && timingSafeEqual(given, expected)
    },
  }
}
