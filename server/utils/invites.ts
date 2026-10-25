import { and, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { inviteSecret } from '../../shared/invite'
import type { Language } from '../../shared/language'
import { db } from '../db'
import { board, inviteMiss, membership } from '../db/schema'
import { slugOf } from './addresses'
import { boardMembers, type BoardMember, type BoardNameAndEmoji } from './boards'
import { accessOn } from './board-access'
import { boardEvent, withEvents } from './events'

// Invite Links (CONTEXT.md): /invite/<Board slug>-<secret> lets a signed-in
// user on the Allowlist become a Member of the Board (shared/invite.ts).
// Only the secret counts: it is the Board's `invite_token`, which never
// expires, and the Owner can reset it. A link from before is the token
// alone, which still counts too.

// What the invite landing shows: the Board, who invited you (its Owner) and
// the first few who are already on it. Public to whoever has the link, so
// no more of the Board than the landing's avatar row needs.
export interface InviteView {
  board: Pick<BoardNameAndEmoji, 'name' | 'emoji'>
  owner: BoardMember
  members: BoardMember[]
}

// How many Members the invite landing shows.
const LANDING_MEMBERS = 4

export function inviteNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Invite Link not found' })
}

// The secret of the Invite Link in the route. A link that can't end in one
// doesn't exist.
export function inviteSecretParam(event: H3Event): string {
  const secret = inviteSecret(getRouterParam(event, 'token') ?? '')
  if (!secret) throw inviteNotFound()
  return secret
}

// The Board a secret opens, or null if none has it (any more). An Archived
// Board's link opens nothing until it is restored.
async function boardOf(secret: string) {
  if (inviteSecret(secret) !== secret) return null
  const [found] = await db
    .select({ id: board.id, slug: slugOf, name: board.name, emoji: board.emoji })
    .from(board)
    .where(and(eq(board.inviteToken, secret), isNull(board.deletedAt)))
  return found ?? null
}

// The invite landing for a secret, or null if no Board has it (any more).
// Members without a Username yet in the visitor's `language`.
export async function inviteView(secret: string, language: Language): Promise<InviteView | null> {
  const found = await boardOf(secret)
  if (!found) return null

  const members = await boardMembers(found.id, language).limit(LANDING_MEMBERS)
  const [owner] = members
  if (!owner?.isOwner) return null
  const strip = ({ isOwner: _, permissions: __, ...m }: typeof owner): BoardMember => m
  return { board: { name: found.name, emoji: found.emoji }, owner: strip(owner), members: members.map(strip) }
}

// Makes the user a Member of the secret's Board (PRD story 64); for someone
// already on it, only this changes (story 65): following the link counts as
// opening the Board, so the app lands on it next. The Board's id and the
// slug of its Address, or null if no Board has the secret (or it was
// archived meanwhile). A new Member gets the Board's Default Permissions;
// one already on it keeps theirs.
export async function joinByInvite(secret: string, userId: string): Promise<{ boardId: string, slug: string } | null> {
  const found = await boardOf(secret)
  if (!found) return null
  const now = sql`${new Date().toISOString()}::timestamptz`
  // Only while the Board isn't archived, reading its row `for share`: a join
  // can't slip in while the Board is being archived (server/utils/archived-boards.ts).
  const { rows } = await withEvents(
    db,
    sql`
      insert into ${membership} (board_id, user_id, last_opened_at, seen_at, permissions)
      select ${board.id}, ${userId}, ${now}, ${now}, ${board.defaultPermissions} from ${board}
      where ${board.id} = ${found.id} and ${board.deletedAt} is null
      for share
      on conflict (board_id, user_id) do update set last_opened_at = excluded.last_opened_at, seen_at = excluded.seen_at
      -- A row the insert made, not one it updated: a join.
      returning board_id, xmax = 0 as joined
    `,
    boardEvent('member_joined', userId),
    { where: sql`changed.joined` },
  )
  return rows.length > 0 ? { boardId: found.id, slug: found.slug } : null
}

// Gives the Board a new secret, so the old link stops working (story 66),
// with its old slug or any other.
// 'forbidden' for a Member who isn't the Owner, null for a non-Member.
export async function resetInvite(boardId: string, userId: string): Promise<{ inviteToken: string } | 'forbidden' | null> {
  const [found] = await accessOn(boardId, userId)
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
// Guessing a secret is hopeless (about 84 bits); to keep it that way for
// anyone trying many, a client that asks for too many secrets no Board has
// gets no answer about any link, not even a working one, for the rest of
// the window. A refused sign-in is no miss: it doesn't look one up. Clients
// are told apart by IP address only, so people behind one address share
// their misses; a few dozen opening a reset link within the window is not
// what this app sees.

const MISSES_ALLOWED = 30
const MISS_WINDOW = sql`now() - interval '15 minutes'`

function tooManyMisses() {
  return createError({ statusCode: 429, statusMessage: 'Too many Invite Links not found' })
}

// Who asks: their IP address. On Vercel, x-forwarded-for is the visitor's,
// set by Vercel and not by the client; a page rendered on the server passes
// it on to the API calls it makes (useFetch, useFetchPassingCookies).
function clientOf(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
}

// Counts one more lookup as a miss before it is made, so lookups sent at
// once can't all slip under the limit: one more in the client's window, or
// the first of a new one. Whether the client is now over the limit.
async function reserveMiss(client: string): Promise<boolean> {
  const inWindow = gt(inviteMiss.windowStart, MISS_WINDOW)
  const [counted] = await db
    .insert(inviteMiss)
    .values({ client })
    .onConflictDoUpdate({
      target: inviteMiss.client,
      set: {
        misses: sql`case when ${inWindow} then ${inviteMiss.misses} + 1 else 1 end`,
        windowStart: sql`case when ${inWindow} then ${inviteMiss.windowStart} else now() end`,
      },
    })
    .returning({ misses: inviteMiss.misses, newWindow: sql<boolean>`${inviteMiss.windowStart} = now()` })
  // Windows that are over need no row; cleared once per new window, not on
  // every lookup.
  if (counted?.newWindow) await db.delete(inviteMiss).where(lt(inviteMiss.windowStart, MISS_WINDOW))
  return (counted?.misses ?? 0) > MISSES_ALLOWED
}

// A lookup that found its Board was no miss after all.
async function refundMiss(client: string) {
  await db
    .update(inviteMiss)
    .set({ misses: sql`greatest(${inviteMiss.misses} - 1, 0)` })
    .where(eq(inviteMiss.client, client))
}

// What `find` finds for this client's Invite Link: 429 while the client has
// missed too often, 404 (a miss) if it finds nothing.
export async function lookUpInvite<T>(event: H3Event, find: () => Promise<T | null>): Promise<T> {
  const client = clientOf(event)
  if (await reserveMiss(client)) throw tooManyMisses()
  const found = await find()
  if (found === null) throw inviteNotFound()
  await refundMiss(client)
  return found
}

// ---------------------------------------------------------------------------
// The remembered invite (story 5): a cookie holding the secret, set on the
// invite landing when the visitor starts signing in. A sign-in that goes
// through joins its Board and clears it (server/utils/auth.ts); a refused one
// leaves it, so "Not unlocked" can name the Owner and a later sign-in still
// joins.

export const REMEMBERED_INVITE_COOKIE = 'malkochen.invite'

// What clears it, wherever that happens.
export const FORGOTTEN_INVITE_COOKIE = { path: '/', maxAge: 0 } as const

// Long enough for the Owner to put the visitor on the Allowlist.
const REMEMBERED_INVITE_MAX_AGE = 60 * 60 * 24 * 30

export function rememberInvite(event: H3Event, secret: string) {
  setCookie(event, REMEMBERED_INVITE_COOKIE, secret, {
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
