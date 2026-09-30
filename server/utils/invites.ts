import { asc, desc, eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { db } from '../db'
import { board, membership, user } from '../db/schema'
import { membershipOf, type BoardMember, type BoardNameAndEmoji } from './boards'

// Invite Links (CONTEXT.md): /invite/<token> lets a signed-in user on the
// Allowlist become a Member of the Board. The token is the Board's
// `invite_token`; it never expires, and the Owner can reset it.

// What the invite landing shows: the Board, who invited you (its Owner) and
// the first few who are already on it. Public to whoever has the link, so
// no more of the Board than the landing's avatar row needs.
export interface InviteView {
  board: Omit<BoardNameAndEmoji, 'id'>
  owner: BoardMember
  members: BoardMember[]
}

// How many Members the invite landing shows.
const LANDING_MEMBERS = 4

// Tokens are 32 hex characters; anything else can't be one.
const TOKEN = /^[0-9a-f]{32}$/

export function inviteNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Invite Link not found' })
}

// An Invite Link token from the route. Anything malformed is a link that doesn't exist.
export function inviteTokenParam(event: H3Event): string {
  const token = getRouterParam(event, 'token') ?? ''
  if (!TOKEN.test(token)) throw inviteNotFound()
  return token
}

// The Board a token opens, or null if none has it (any more).
async function boardOf(token: string) {
  if (!TOKEN.test(token)) return null
  const [found] = await db
    .select({ id: board.id, name: board.name, emoji: board.emoji })
    .from(board)
    .where(eq(board.inviteToken, token))
  return found ?? null
}

// The invite landing for a token, or null if no Board has it (any more).
export async function inviteView(token: string): Promise<InviteView | null> {
  const found = await boardOf(token)
  if (!found) return null

  const members = await db
    .select({ id: user.id, name: user.name, image: user.image, isOwner: membership.isOwner })
    .from(membership)
    .innerJoin(user, eq(user.id, membership.userId))
    .where(eq(membership.boardId, found.id))
    .orderBy(desc(membership.isOwner), asc(membership.joinedAt))
    .limit(LANDING_MEMBERS)
  const [owner] = members
  if (!owner?.isOwner) return null
  const strip = ({ isOwner: _, ...m }: typeof owner): BoardMember => m
  return { board: { name: found.name, emoji: found.emoji }, owner: strip(owner), members: members.map(strip) }
}

// Makes the user a Member of the token's Board (PRD story 64); for someone
// already on it, only this changes (story 65): following the link counts as
// opening the Board, so the app lands on it next. The Board's id, or null if
// no Board has the token.
export async function joinByInvite(token: string, userId: string): Promise<string | null> {
  const found = await boardOf(token)
  if (!found) return null
  const now = new Date()
  await db
    .insert(membership)
    .values({ boardId: found.id, userId, lastOpenedAt: now })
    .onConflictDoUpdate({ target: [membership.boardId, membership.userId], set: { lastOpenedAt: now } })
  return found.id
}

// Gives the Board a new token, so the old link stops working (story 66).
// 'forbidden' for a Member who isn't the Owner, null for a non-Member.
export async function resetInvite(boardId: string, userId: string): Promise<{ inviteToken: string } | 'forbidden' | null> {
  const [found] = await membershipOf(boardId, userId)
  if (!found) return null
  if (!found.isOwner) return 'forbidden'
  const [updated] = await db
    .update(board)
    .set({ inviteToken: sql`default` })
    .where(eq(board.id, boardId))
    .returning({ inviteToken: board.inviteToken })
  return updated ?? null
}

// ---------------------------------------------------------------------------
// The remembered invite (story 5): a cookie holding the token, set on the
// invite landing when the visitor starts signing in. A sign-in that goes
// through joins its Board and clears it (server/utils/auth.ts); a refused one
// leaves it, so "Not unlocked" can name the Owner and a later sign-in still
// joins.

export const REMEMBERED_INVITE_COOKIE = 'malkochen.invite'

// What clears it, wherever that happens.
export const FORGOTTEN_INVITE_COOKIE = { path: '/', maxAge: 0 } as const

// Long enough for the Owner to put the visitor on the Allowlist.
const REMEMBERED_INVITE_MAX_AGE = 60 * 60 * 24 * 30

export function rememberInvite(event: H3Event, token: string) {
  setCookie(event, REMEMBERED_INVITE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getRequestURL(event).protocol === 'https:',
    path: '/',
    maxAge: REMEMBERED_INVITE_MAX_AGE,
  })
}

export function rememberedInvite(event: H3Event): string | undefined {
  return getCookie(event, REMEMBERED_INVITE_COOKIE)
}

export function forgetInvite(event: H3Event) {
  setCookie(event, REMEMBERED_INVITE_COOKIE, '', FORGOTTEN_INVITE_COOKIE)
}
