import { and, desc, eq, exists, gt, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Language } from '../../shared/language'
import { db } from '../db'
import { board, dish, membership, pushSubscription, user } from '../db/schema'
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

// After `adderId` added Dish `dishId` to the Board: every other Member who
// turned push notifications on gets the Board's notification on each of
// their devices, counting the Dishes others added since they last had the
// Board open, in their language. A subscription the push service says is
// gone is deleted.
// Never rejects: adding the Dish has worked whatever happens here.
export async function notifyNewDish(boardId: string, dishId: string, adderId: string): Promise<void> {
  if (!sendPush) return
  try {
    const news = await boardNews(boardId, dishId, adderId)
    if (news.size === 0) return
    const targets = await db
      .select({ userId: pushSubscription.userId, endpoint: pushSubscription.endpoint, p256dh: pushSubscription.p256dh, auth: pushSubscription.auth })
      .from(pushSubscription)
      .where(inArray(pushSubscription.userId, [...news.keys()]))
    const outcomes = await Promise.all(targets.map(async target => ({
      endpoint: target.endpoint,
      outcome: await sendPush(target, pushMessage(...news.get(target.userId)!)),
    })))
    const gone = outcomes.filter(o => o.outcome === 'gone').map(o => o.endpoint)
    if (gone.length > 0) await db.delete(pushSubscription).where(inArray(pushSubscription.endpoint, gone))
  }
  catch (err) {
    console.warn(`[push] Board ${boardId} not notified:`, err)
  }
}

// What each Member to notify gets told, by user id, and in which language:
// the Dishes other Members added since that Member last had the Board open
// (or joined it), and always the new one, whatever the clocks say.
async function boardNews(boardId: string, dishId: string, adderId: string): Promise<Map<string, [Language, BoardNews]>> {
  const [found] = await db
    .select({ id: board.id, slug: slugOf, name: board.name, emoji: board.emoji })
    .from(board)
    .where(eq(board.id, boardId))
  if (!found) return new Map()

  const recipient = alias(user, 'recipient')
  const rows = await db
    .select({
      recipient: membership.userId,
      language: recipient.language,
      browserLanguage: recipient.browserLanguage,
      title: dish.title,
      code: dish.code,
      // Adding takes a Username (server/middleware/auth.ts).
      addedBy: sql<string>`${user.username}`,
    })
    .from(membership)
    .innerJoin(recipient, eq(recipient.id, membership.userId))
    .innerJoin(dish, and(
      eq(dish.boardId, membership.boardId),
      isNull(dish.deletedAt),
      isNotNull(dish.addedBy),
      ne(dish.addedBy, membership.userId),
      or(eq(dish.id, dishId), gt(dish.createdAt, sql`coalesce(${membership.seenAt}, ${membership.joinedAt})`)),
    ))
    .innerJoin(user, eq(user.id, dish.addedBy))
    .where(and(
      eq(membership.boardId, boardId),
      ne(membership.userId, adderId),
      exists(db.select({ userId: pushSubscription.userId }).from(pushSubscription).where(eq(pushSubscription.userId, membership.userId))),
    ))
    .orderBy(desc(dish.createdAt), desc(dish.id))

  const news = new Map<string, [Language, BoardNews]>()
  for (const { recipient, language, browserLanguage, ...added } of rows) {
    const theirs = news.get(recipient) ?? [recipientLanguage({ language, browserLanguage }), { board: found, dishes: [] }]
    theirs[1].dishes.push(added)
    news.set(recipient, theirs)
  }
  return news
}
