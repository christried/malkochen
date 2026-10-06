// Invite Links (CONTEXT.md: Invite Link): /invite/<Board slug>-<secret>.
// Only the secret counts: the slug part only makes the link readable, so
// renaming the Board never breaks a link sent before. A link from before
// readable Invite Links is the Board's old token alone (/invite/<token>);
// it keeps working until the Owner resets the link.

// A secret: 17 characters from an alphabet without look-alikes (0/o,
// 1/l/i), about 84 bits (random_invite_secret(), migration 0014).
const SECRET = /^[23456789abcdefghjkmnpqrstuvwxyz]{17}$/
// The token a Board had before: 32 hex characters.
const OLD_TOKEN = /^[0-9a-f]{32}$/

export function invitePath(board: { slug: string, inviteToken: string }): string {
  return `/invite/${board.slug}-${board.inviteToken}`
}

// The secret an Invite Link's last part ends in, or null if it can't be one.
export function inviteSecret(segment: string): string | null {
  const secret = segment.slice(segment.lastIndexOf('-') + 1).toLowerCase()
  return SECRET.test(secret) || OLD_TOKEN.test(secret) ? secret : null
}
