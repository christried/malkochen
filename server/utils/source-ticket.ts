import type { DishSource } from './dishes'
import { sourceTickets } from './image-store'
import { playableFor } from './playable-video'

// Source Tickets (server/image-store/tickets.ts): what Source Lookup read from a
// Source, signed for the Member who asked, so a Dish keeps a Caption only if
// Source Lookup found it, never one a client makes up. The same goes for
// whether an Instagram post has a video that plays in malkochen (#394). The
// facts are built in this one place, so the ticket and the check always agree
// on them.

// The facts a Source Ticket vouches for: the canonical link, the Caption
// (null when the Source shows none) and whether the Source has a video that
// plays in malkochen. A ticket says what Source Lookup read, including "no
// Caption" for a link without one.
export interface SourceFacts {
  canonicalLink: string
  caption: string | null
  playableVideo: boolean
}

export function sourceFacts(result: SourceFacts): string {
  return JSON.stringify({ link: result.canonicalLink, caption: result.caption, playableVideo: result.playableVideo })
}

// The Source Ticket GET /api/source-lookup answers with, for the Member asking.
export function issueSourceTicket(userId: string, result: SourceFacts): string {
  return sourceTickets.issue(userId, sourceFacts(result))
}

// The Caption and the playable-video value a client sent with a Source, if the
// ticket it sent is one Source Lookup signed for that same link, Caption and
// value and for this Member; else none (null).
export function checkedSourceFacts(userId: string, sent: { link: string, caption: string | null, playableVideo: boolean | null | undefined, ticket: string | null | undefined }): { caption: string | null, playableVideo: boolean } | null {
  if (!sent.ticket) return null
  const playableVideo = sent.playableVideo ?? false
  const vouched = sourceTickets.check(userId, sourceFacts({ canonicalLink: sent.link, caption: sent.caption, playableVideo }), sent.ticket)
  return vouched ? { caption: sent.caption, playableVideo } : null
}

// What a Dish keeps of its Source's facts (#393, #394), from what the client
// sent with the Source. The Caption only with a valid ticket; whether a video
// plays as playableFor says, with Source Lookup's answer only from a valid
// ticket.
export function storedSourceFacts(
  userId: string,
  source: DishSource | null,
  sent: { caption: string | null, playableVideo: boolean | null | undefined, ticket: string | null | undefined },
): { caption: string | null, playableVideo: boolean | null } {
  if (!source) return { caption: null, playableVideo: null }
  const checked = checkedSourceFacts(userId, { link: source.link, ...sent })
  return { caption: checked?.caption ?? null, playableVideo: playableFor(source, checked?.playableVideo) }
}
