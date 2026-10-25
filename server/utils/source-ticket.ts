import { sourceTickets } from './image-store'

// Source Tickets (server/image-store/tickets.ts): what Source Lookup read from a
// Source, signed for the Member who asked, so a Dish keeps a Caption only if
// Source Lookup found it, never one a client makes up. The facts are built in
// this one place, so the ticket and the check always agree on them.

// The facts a Source Ticket vouches for: the canonical link and the Caption
// (null when the Source shows none). A ticket says what Source Lookup read,
// including "no Caption" for a link without one.
export function sourceFacts(result: { canonicalLink: string, caption: string | null }): string {
  return JSON.stringify({ link: result.canonicalLink, caption: result.caption })
}

// The Source Ticket GET /api/source-lookup answers with, for the Member asking.
export function issueSourceTicket(userId: string, result: { canonicalLink: string, caption: string | null }): string {
  return sourceTickets.issue(userId, sourceFacts(result))
}

// The Caption a client sent with a Source, if the ticket it sent is one Source
// Lookup signed for that same link and Caption and for this Member; else none.
export function checkedCaption(userId: string, sent: { link: string, caption: string | null, ticket: string | null | undefined }): string | null {
  if (!sent.ticket) return null
  const vouched = sourceTickets.check(userId, sourceFacts({ canonicalLink: sent.link, caption: sent.caption }), sent.ticket)
  return vouched ? sent.caption : null
}
