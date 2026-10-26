import { and, eq, isNull, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { dishLinkPath, dishLinkSecret } from '../../shared/dish-link'
import type { Placeholder } from '../../shared/placeholders'
import { db } from '../db'
import { board, dish } from '../db/schema'
import type { SourceKind } from '../source-lookup'
import { auth, signInRefusal, type SessionUser } from './auth'
import { accessOn } from './board-access'
import { detailsOf, recordEvents } from './events'
import { FORGOTTEN_INVITE_COOKIE, lookUpSecret } from './invites'

// Dish Links (CONTEXT.md: Dish Link): /d/<title slug>-<secret> (shared/dish-link.ts)
// lets anyone, signed in or not, see one Dish. The secret is the Dish's
// `link_secret`, made the first time a Member shares it and kept through
// archive and restore. Only the secret counts.

// What the Dish Link page shows: the Dish's own fields, and nothing of its
// Board (no name, Members, history, who added it, Caption or Cookings), but
// for the Board's id where the viewer is on that Board (`ownBoard`).
export interface DishLinkView {
  title: string
  imageUrl: string | null
  placeholder: Placeholder
  focus: { x: number, y: number }
  creator: string | null
  source: { kind: SourceKind, link: string } | null
  // The link as it reads now (with the Dish's current title), for the page's
  // Open Graph address.
  path: string
  // The Dish's Board's id, only for a viewer who is on that Board (a Member
  // of it, whatever their Permissions): the Dish Link page's Copy picker
  // leaves it out, since a Copy onto the same Board is refused. The key is
  // absent for anyone else, signed out included.
  ownBoard?: string
}

// The remembered Dish Link (#403): a cookie holding the secret, set when a
// signed-out visitor taps "Auf mein Board kopieren", so it survives the trip
// through sign-in and sign-up. The landing answers it once and clears it,
// and so does the Copy it leads to. An hour: long enough for a sign-up with
// a Username, short enough that a forgotten one doesn't take over a later
// landing.
export const REMEMBERED_DISH_LINK_COOKIE = 'malkochen.dish-link'

const REMEMBERED_DISH_LINK_MAX_AGE = 60 * 60

export function rememberDishLink(event: H3Event, secret: string) {
  setCookie(event, REMEMBERED_DISH_LINK_COOKIE, secret, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getRequestURL(event).protocol === 'https:',
    path: '/',
    maxAge: REMEMBERED_DISH_LINK_MAX_AGE,
  })
}

export function rememberedDishLink(event: H3Event): string | undefined {
  return getCookie(event, REMEMBERED_DISH_LINK_COOKIE)
}

export function forgetDishLink(event: H3Event) {
  setCookie(event, REMEMBERED_DISH_LINK_COOKIE, '', FORGOTTEN_INVITE_COOKIE)
}

export function dishLinkNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Dish Link not found' })
}

// The path of the Dish's link, making its secret if it has none yet; null
// unless the user may see the Dish's Board (any Member may share, whatever
// their Permissions) and the Dish and its Board are both live.
export async function shareDish(dishId: string, userId: string): Promise<string | null> {
  const [found] = await db
    .select({ boardId: dish.boardId })
    .from(dish)
    .innerJoin(board, eq(board.id, dish.boardId))
    .where(and(eq(dish.id, dishId), isNull(dish.deletedAt), isNull(board.deletedAt)))
  if (!found) return null
  const [access] = await accessOn(found.boardId, userId)
  if (!access) return null

  // Only the first share writes the Dish: a write to a Dish moves its Board Version (migration 0032).
  const [made] = await db
    .update(dish)
    .set({ linkSecret: sql`random_invite_secret()` })
    .where(and(eq(dish.id, dishId), isNull(dish.deletedAt), isNull(dish.linkSecret)))
    .returning({ title: dish.title, linkSecret: dish.linkSecret })
  const [shared] = made
    ? [made]
    : await db
      .select({ title: dish.title, linkSecret: dish.linkSecret })
      .from(dish)
      .where(and(eq(dish.id, dishId), isNull(dish.deletedAt)))
  return shared?.linkSecret ? dishLinkPath({ title: shared.title, linkSecret: shared.linkSecret }) : null
}

// The Dish a secret opens, or null if none has it (any more): an Archived
// Dish and a Dish on an Archived Board open nothing until restored.
export async function liveDishBySecret(secret: string) {
  const [found] = await db
    .select({
      id: dish.id,
      boardId: dish.boardId,
      title: dish.title,
      imageUrl: dish.imageUrl,
      placeholder: dish.placeholder,
      focusX: dish.imageFocusX,
      focusY: dish.imageFocusY,
      creator: dish.creator,
      sourceLink: dish.sourceLink,
      sourceKind: dish.sourceKind,
    })
    .from(dish)
    .innerJoin(board, eq(board.id, dish.boardId))
    .where(and(eq(dish.linkSecret, secret), isNull(dish.deletedAt), isNull(board.deletedAt)))
  return found ?? null
}

// The signed-in user of a request to a public route, or null: never
// throws, since being signed out is what the route is for.
async function optionalUser(event: H3Event): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: event.headers }).catch(() => null)
  return session && !signInRefusal(session.user) ? session.user : null
}

// The Dish Link page's data for the link in the route (what follows /d/),
// and the event that someone opened it. 404 for a link that can't end in a
// secret or that no live Dish has; limited per client with Invite Links.
export async function openDishLink(event: H3Event, link: string): Promise<DishLinkView> {
  const secret = dishLinkSecret(link)
  const found = await lookUpSecret(event, async () => (secret ? liveDishBySecret(secret) : null), dishLinkNotFound)
  const user = await optionalUser(event)
  const [member] = user ? await accessOn(found.boardId, user.id) : []
  await recordEvents(
    db,
    {
      kind: 'dish_link_opened',
      board: sql`${found.boardId}`,
      dish: sql`${found.id}`,
      user: user?.id ?? null,
      details: detailsOf({ signedIn: user !== null }),
    },
    sql``,
  )
  return {
    title: found.title,
    imageUrl: found.imageUrl,
    placeholder: found.placeholder,
    focus: { x: found.focusX, y: found.focusY },
    creator: found.creator,
    source: found.sourceLink && found.sourceKind ? { kind: found.sourceKind, link: found.sourceLink } : null,
    path: dishLinkPath({ title: found.title, linkSecret: secret! }),
    ...member && { ownBoard: found.boardId },
  }
}
