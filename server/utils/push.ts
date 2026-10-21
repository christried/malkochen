import { and, desc, eq, exists, gt, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Language } from '../../shared/language'
import { db } from '../db'
import { board, comment, dish, eventLog, membership, pushSubscription, user, vote } from '../db/schema'
import { parseServerEnv } from '../env'
import { createPushSender, isPushEndpoint, pushMessage, type BoardNews, type PushTarget } from '../push'
import { slugOf } from './addresses'
import { recipientLanguage } from './people'

const env = parseServerEnv(process.env)

// Push notifications (#219), when the VAPID keys are set: one global switch
// per device in a Member's settings. Without them, none are offered or sent.
const sendPush = env.VAPID_PUBLIC_KEY
  ? createPushSender({
      vapid: { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
      onFailure: reason => console.warn(`[push] not sent: ${reason}`),
    })
  : null

export const pushOffered = sendPush !== null

// Local dev and tests subscribe their devices on a stand-in push service.
export const isAcceptedPushEndpoint = (endpoint: string) => isPushEndpoint(endpoint, { anyService: env.AUTH_DEV_BYPASS === '1' })

// The most devices a user gets push notifications on; turning it on for one
// more drops the one turned on longest ago.
const MAX_DEVICES = 10

// Turns push notifications on for the user's device. A device someone else
// turned it on for before is theirs from now on.
export async function turnOnPush(userId: string, target: PushTarget): Promise<void> {
  const subscription = { userId, p256dh: target.p256dh, auth: target.auth, createdAt: new Date() }
  await db
    .insert(pushSubscription)
    .values({ endpoint: target.endpoint, ...subscription })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: subscription })
  await db.delete(pushSubscription).where(and(
    eq(pushSubscription.userId, userId),
    sql`${pushSubscription.endpoint} not in (select ${pushSubscription.endpoint} from ${pushSubscription} where ${pushSubscription.userId} = ${userId} order by ${pushSubscription.createdAt} desc limit ${MAX_DEVICES})`,
  ))
}

// Turns them off for the user's device; a device of someone else's stays as it is.
export async function turnOffPush(userId: string, endpoint: string): Promise<void> {
  await db.delete(pushSubscription).where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)))
}

// Whether the user turned them on for the device.
export async function isPushOn(userId: string, endpoint: string): Promise<boolean> {
  const [found] = await db
    .select({ endpoint: pushSubscription.endpoint })
    .from(pushSubscription)
    .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)))
  return found !== undefined
}

// What a notification is sent for: a Dish added, a Comment written on a
// Dish, or a Vote given on one. Whatever the clocks say, it is counted.
type Latest = { dishId: string } | { commentId: string } | { voteOn: string }

// After `adderId` added Dish `dishId` to the Board: every other Member who
// turned push notifications on gets the Board's notification (`notify`).
export function notifyNewDish(boardId: string, dishId: string, adderId: string): Promise<void> {
  return notify(boardId, adderId, { dishId })
}

// After `authorId` wrote Comment `commentId` on Dish `dishId` (#352).
export async function notifyComment(dishId: string, commentId: string, authorId: string): Promise<void> {
  const boardId = await boardOf(dishId)
  if (boardId) await notify(boardId, authorId, { commentId })
}

// After `voterId` gave a new Vote on Dish `dishId`; changing one sends
// nothing (#352).
export async function notifyVote(dishId: string, voterId: string): Promise<void> {
  const boardId = await boardOf(dishId)
  if (boardId) await notify(boardId, voterId, { voteOn: dishId })
}

async function boardOf(dishId: string): Promise<string | null> {
  if (!sendPush) return null
  const [found] = await db.select({ boardId: dish.boardId }).from(dish).where(eq(dish.id, dishId))
  return found?.boardId ?? null
}

// Every Member of the Board but `actorId` who turned push notifications on
// gets the Board's notification on each of their devices, counting the
// Dishes, Comments and Votes others added since they last had the Board
// open, in their language. A subscription the push service says is gone is
// deleted.
// Never rejects: what it is sent for has worked whatever happens here.
async function notify(boardId: string, actorId: string, latest: Latest): Promise<void> {
  if (!sendPush) return
  try {
    const news = await boardNews(boardId, actorId, latest)
    if (news.size === 0) return
    const targets = await db
      .select({ userId: pushSubscription.userId, endpoint: pushSubscription.endpoint, p256dh: pushSubscription.p256dh, auth: pushSubscription.auth })
      .from(pushSubscription)
      .where(inArray(pushSubscription.userId, [...news.keys()]))
    const outcomes = await Promise.all(targets.map(async (target) => {
      const { language, news: theirs } = news.get(target.userId)!
      return { endpoint: target.endpoint, outcome: await sendPush(target, pushMessage(language, theirs)) }
    }))
    const gone = outcomes.filter(o => o.outcome === 'gone').map(o => o.endpoint)
    if (gone.length > 0) await db.delete(pushSubscription).where(inArray(pushSubscription.endpoint, gone))
  }
  catch (err) {
    console.warn(`[push] Board ${boardId} not notified:`, err)
  }
}

// What each Member to notify gets told, by user id, and in which language:
// the Dishes other Members added since that Member last had the Board open
// (or joined it), and the Comments and Votes they gave since on Dishes
// that aren't archived, Comments not deleted, and always `latest`. A Member
// with nothing to be told isn't in it.
async function boardNews(boardId: string, actorId: string, latest: Latest): Promise<Map<string, { language: Language, news: BoardNews }>> {
  const [found] = await db
    .select({ id: board.id, slug: slugOf, name: board.name, emoji: board.emoji })
    .from(board)
    .where(eq(board.id, boardId))
  if (!found) return new Map()

  const toNotify = and(
    eq(membership.boardId, boardId),
    ne(membership.userId, actorId),
    exists(db.select({ userId: pushSubscription.userId }).from(pushSubscription).where(eq(pushSubscription.userId, membership.userId))),
  )
  const since = sql`coalesce(${membership.seenAt}, ${membership.joinedAt})`
  const onBoard = and(eq(dish.boardId, membership.boardId), isNull(dish.deletedAt))
  const recipient = alias(user, 'recipient')
  const [members, added, comments, votes] = await Promise.all([
    db
      .select({ id: membership.userId, language: recipient.language, browserLanguage: recipient.browserLanguage })
      .from(membership)
      .innerJoin(recipient, eq(recipient.id, membership.userId))
      .where(toNotify),
    db
      .select({
        recipient: membership.userId,
        title: dish.title,
        code: dish.code,
        // Adding takes a Username (server/middleware/auth.ts).
        addedBy: sql<string>`${user.username}`,
      })
      .from(membership)
      .innerJoin(dish, and(
        onBoard,
        isNotNull(dish.addedBy),
        ne(dish.addedBy, membership.userId),
        or('dishId' in latest ? eq(dish.id, latest.dishId) : undefined, gt(dish.createdAt, since)),
      ))
      .innerJoin(user, eq(user.id, dish.addedBy))
      .where(toNotify)
      .orderBy(desc(dish.createdAt), desc(dish.id)),
    db
      .select({
        recipient: membership.userId,
        title: dish.title,
        code: dish.code,
        // Writing one takes a Username, as voting does.
        by: sql<string>`${user.username}`,
        text: comment.text,
        at: comment.createdAt,
      })
      .from(membership)
      .innerJoin(dish, onBoard)
      .innerJoin(comment, and(
        eq(comment.dishId, dish.id),
        isNull(comment.deletedAt),
        ne(comment.authorId, membership.userId),
        or('commentId' in latest ? eq(comment.id, latest.commentId) : undefined, gt(comment.createdAt, since)),
      ))
      .innerJoin(user, eq(user.id, comment.authorId))
      .where(toNotify),
    db
      .select({
        recipient: membership.userId,
        title: dish.title,
        code: dish.code,
        by: sql<string>`${user.username}`,
        up: vote.up,
        at: vote.votedAt,
      })
      .from(membership)
      .innerJoin(dish, onBoard)
      .innerJoin(vote, and(
        eq(vote.dishId, dish.id),
        ne(vote.userId, membership.userId),
        // Given since, not just changed since: a changed Vote never counts
        // again. Taken back and given again, it is a new one.
        or('voteOn' in latest ? and(eq(vote.dishId, latest.voteOn), eq(vote.userId, actorId)) : undefined, exists(db
          .select({ id: eventLog.id })
          .from(eventLog)
          .where(and(eq(eventLog.kind, 'vote_set'), eq(eventLog.dishId, vote.dishId), eq(eventLog.userId, vote.userId), gt(eventLog.at, since))))),
      ))
      .innerJoin(user, eq(user.id, vote.userId))
      .where(toNotify),
  ])

  const news = new Map<string, { language: Language, news: Required<BoardNews> }>(
    members.map(m => [m.id, { language: recipientLanguage(m), news: { board: found, dishes: [], talk: [] } }]),
  )
  for (const { recipient, ...addedDish } of added) news.get(recipient)?.news.dishes.push(addedDish)
  const talk = [
    ...comments.map(({ recipient, title, code, by, text, at }) => ({ recipient, at, said: { dish: { title, code }, by, comment: text } })),
    ...votes.map(({ recipient, title, code, by, up, at }) => ({ recipient, at, said: { dish: { title, code }, by, up } })),
  ].toSorted((a, b) => b.at.getTime() - a.at.getTime())
  for (const { recipient, said } of talk) news.get(recipient)?.news.talk.push(said)
  for (const [id, { news: theirs }] of news) {
    if (theirs.dishes.length === 0 && theirs.talk.length === 0) news.delete(id)
  }
  return news
}
