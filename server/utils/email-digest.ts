import { and, desc, eq, exists, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm'
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { db } from '../db'
import { board, comment, dish, emailDigest, eventLog, membership, user, vote } from '../db/schema'
import { digestEmail, type BoardNews, type Email } from '../email'
import { parseServerEnv } from '../env'
import { mailSender } from './mail'
import { slugOf } from './addresses'
import { signInRefusal } from './auth'
import { detailsOf, withEvents } from './events'
import { recipientLanguage } from './people'

const env = parseServerEnv(process.env)

// The Email Digest (#220), when the Resend API key is set: one switch in a
// Member's settings, for all their Boards. Without it, none is offered or sent.
const sendEmails = mailSender(reason => console.warn(`[email-digest] not sent: ${reason}`))

export const digestOffered = sendEmails !== null

// Now, in whole milliseconds (emailDigest.coveredUntil).
const nowInMs = sql<Date>`date_trunc('milliseconds', now())`

// Switched on, the first digest lists what is added from now on. A switch in
// the event log (#399) only when it was off: a row inserted.
export async function switchDigestOn(userId: string): Promise<void> {
  await withEvents(
    db,
    db.insert(emailDigest).values({ userId, coveredUntil: nowInMs }).onConflictDoNothing().returning({ userId: emailDigest.userId }),
    { kind: 'digest_switched', board: sql`null`, user: userId, details: detailsOf({ on: true }) },
    { once: true },
  )
}

// A switch in the event log (#399) only when it was on: a row deleted.
export async function switchDigestOff(userId: string): Promise<void> {
  await withEvents(
    db,
    db.delete(emailDigest).where(eq(emailDigest.userId, userId)).returning({ userId: emailDigest.userId }),
    { kind: 'digest_switched', board: sql`null`, user: userId, details: detailsOf({ on: false }) },
    { once: true },
  )
}

export async function isDigestOn(userId: string): Promise<boolean> {
  const [found] = await db.select({ userId: emailDigest.userId }).from(emailDigest).where(eq(emailDigest.userId, userId))
  return found !== undefined
}

export interface DigestReport {
  // Members who have it switched on, and so were covered up to now.
  covered: number
  sent: number
  failed: number
}

// The daily run: each Member who switched the digest on gets one email
// listing the Dishes other Members added to their Boards since the last run
// (and since they joined each Board), and the Comments and Votes they gave
// on them (#353), if there are any. What it covered is
// never listed again; a digest that didn't go out is covered by the next
// run instead.
export async function sendDigests(): Promise<DigestReport> {
  if (!sendEmails) return { covered: 0, sent: 0, failed: 0 }
  const covered = await claimCoverage()
  if (covered.length === 0) return { covered: 0, sent: 0, failed: 0 }

  let digests: Map<string, Digest>
  try {
    digests = await digestEmails(covered)
  }
  catch (err) {
    // Nothing went out: the next run covers it all again.
    await uncover(covered)
    throw err
  }

  const { failed } = await sendEmails([...digests.values()].map(d => d.email))
  const notSent = new Set(failed)
  await recordDigestsSent([...digests].filter(([, d]) => !notSent.has(d.email.to)))
  await uncover(covered.filter(c => notSent.has(digests.get(c.userId)?.email.to ?? '')))
  return { covered: covered.length, sent: digests.size - notSent.size, failed: notSent.size }
}

// One digest to send: its email, and how many Boards it lists.
interface Digest {
  email: Email
  boards: number
}

// Each digest to send, by user id: everyone with news who may still sign
// in.
async function digestEmails(covered: Coverage[]): Promise<Map<string, Digest>> {
  const news = await newsFor(covered)
  if (news.size === 0) return new Map()
  const recipients = await db
    .select({ id: user.id, email: user.email, name: user.username, emailVerified: user.emailVerified, language: user.language, browserLanguage: user.browserLanguage })
    .from(user)
    .where(inArray(user.id, [...news.keys()]))
  const origin = env.BETTER_AUTH_URL.replace(/\/+$/, '')
  return new Map(recipients
    .filter(r => !signInRefusal(r))
    .map((r): [string, Digest] => [r.id, { email: digestEmail({ ...r, language: recipientLanguage(r) }, news.get(r.id)!, origin), boards: news.get(r.id)!.length }]))
}

// One digest_sent event per digest that went out (#399), in one insert. A
// failure to record is logged and never thrown: the emails went out.
async function recordDigestsSent(sent: [string, Digest][]): Promise<void> {
  if (sent.length === 0) return
  try {
    await db.insert(eventLog).values(sent.map(([userId, { boards }]) => ({ kind: 'digest_sent' as const, boardId: null, dishId: null, userId, details: { boards } })))
  }
  catch (err) {
    console.warn('[event-log] digest_sent not recorded:', err)
  }
}

// What one run covers for a Member: what was added in (since, until].
interface Coverage {
  userId: string
  since: Date
  until: Date
}

// Moves every switched-on Member's coveredUntil on to now, and hands back
// what each run covers for them: (since, until]. All in one statement: a run
// started at the same time covers each of them at most once, as only one of
// the two finds coveredUntil still where it read it.
async function claimCoverage(): Promise<Coverage[]> {
  const before = alias(emailDigest, 'before')
  return db
    .update(emailDigest)
    .set({ coveredUntil: nowInMs })
    .from(before)
    .where(and(
      eq(before.userId, emailDigest.userId),
      eq(emailDigest.coveredUntil, before.coveredUntil),
      lt(before.coveredUntil, nowInMs),
    ))
    .returning({ userId: emailDigest.userId, since: before.coveredUntil, until: emailDigest.coveredUntil })
}

// A digest that didn't go out: what it covered is covered again by the next run,
// unless they switched it off (and on) meanwhile.
async function uncover(covered: Coverage[]): Promise<void> {
  if (covered.length === 0) return
  await Promise.all(covered.map(c => db
    .update(emailDigest)
    .set({ coveredUntil: c.since })
    .where(and(eq(emailDigest.userId, c.userId), eq(emailDigest.coveredUntil, c.until)))))
}

// What each Member gets, by user id: per Board they are on (by name), the
// Dishes other Members added in what this run covers for them, and the
// Comments others wrote and the Votes they gave on its Dishes in it (#353),
// each newest first. Never on a Dish archived since, nor a Comment deleted
// since; nothing from before they joined the Board. A Vote counts when it
// was given in it, not when changed: given before, it was listed then.
// Members with nothing new are left out.
async function newsFor(covered: Coverage[]): Promise<Map<string, BoardNews[]>> {
  const onBoard = and(eq(dish.boardId, membership.boardId), isNull(dish.deletedAt))
  const inCoverage = (at: AnyPgColumn) => or(...covered.map(c => and(eq(membership.userId, c.userId), gt(at, c.since), lte(at, c.until))))
  const boardColumns = { id: board.id, slug: slugOf, name: board.name, emoji: board.emoji }
  const [added, comments, votes] = await Promise.all([
    db
      .select({
        recipient: membership.userId,
        board: boardColumns,
        title: dish.title,
        code: dish.code,
        // Adding takes a Username (server/middleware/auth.ts).
        addedBy: sql<string>`${user.username}`,
      })
      .from(membership)
      .innerJoin(board, eq(board.id, membership.boardId))
      .innerJoin(dish, and(
        onBoard,
        isNotNull(dish.addedBy),
        ne(dish.addedBy, membership.userId),
        gt(dish.createdAt, membership.joinedAt),
      ))
      .innerJoin(user, eq(user.id, dish.addedBy))
      .where(inCoverage(dish.createdAt))
      .orderBy(desc(dish.createdAt), desc(dish.id)),
    db
      .select({
        recipient: membership.userId,
        board: boardColumns,
        title: dish.title,
        code: dish.code,
        // Writing one takes a Username, as voting does.
        by: sql<string>`${user.username}`,
        text: comment.text,
        at: comment.createdAt,
      })
      .from(membership)
      .innerJoin(board, eq(board.id, membership.boardId))
      .innerJoin(dish, onBoard)
      .innerJoin(comment, and(
        eq(comment.dishId, dish.id),
        isNull(comment.deletedAt),
        ne(comment.authorId, membership.userId),
        gt(comment.createdAt, membership.joinedAt),
      ))
      .innerJoin(user, eq(user.id, comment.authorId))
      .where(inCoverage(comment.createdAt)),
    db
      .select({
        recipient: membership.userId,
        board: boardColumns,
        title: dish.title,
        code: dish.code,
        by: sql<string>`${user.username}`,
        up: vote.up,
        at: vote.votedAt,
      })
      .from(membership)
      .innerJoin(board, eq(board.id, membership.boardId))
      .innerJoin(dish, onBoard)
      .innerJoin(vote, and(eq(vote.dishId, dish.id), ne(vote.userId, membership.userId)))
      .innerJoin(user, eq(user.id, vote.userId))
      .where(exists(db
        .select({ id: eventLog.id })
        .from(eventLog)
        .where(and(
          eq(eventLog.kind, 'vote_set'),
          eq(eventLog.dishId, vote.dishId),
          eq(eventLog.userId, vote.userId),
          gt(eventLog.at, membership.joinedAt),
          inCoverage(eventLog.at),
        )))),
  ])

  const byRecipient = new Map<string, Map<string, Required<BoardNews>>>()
  const newsOf = (recipient: string, found: BoardNews['board']) => {
    const boards = byRecipient.get(recipient) ?? new Map<string, Required<BoardNews>>()
    byRecipient.set(recipient, boards)
    const news = boards.get(found.id) ?? { board: found, dishes: [], talk: [] }
    boards.set(found.id, news)
    return news
  }
  for (const { recipient, board: found, ...addedDish } of added) newsOf(recipient, found).dishes.push(addedDish)
  const talk = [
    ...comments.map(({ recipient, board: found, title, code, by, text, at }) => ({ recipient, found, at, said: { dish: { title, code }, by, comment: text } })),
    ...votes.map(({ recipient, board: found, title, code, by, up, at }) => ({ recipient, found, at, said: { dish: { title, code }, by, up } })),
  // Newest first; at the same moment, Comments before Votes, as listed.
  ].toSorted((a, b) => b.at.getTime() - a.at.getTime())
  for (const { recipient, found, said } of talk) newsOf(recipient, found).talk.push(said)
  return new Map([...byRecipient].map(([recipient, boards]) => [
    recipient,
    [...boards.values()].toSorted((a, b) => a.board.name.localeCompare(b.board.name, 'de')),
  ]))
}
