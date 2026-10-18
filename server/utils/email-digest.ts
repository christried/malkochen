import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../db'
import { board, dish, emailDigest, membership, user } from '../db/schema'
import { createMailSender, digestEmail, type BoardNews, type Email } from '../email'
import { parseServerEnv } from '../env'
import { slugOf } from './addresses'
import { signInRefusal } from './auth'
import { usernameOf } from './people'

const env = parseServerEnv(process.env)

// The Email Digest (#220), when the Resend API key is set: one switch in a
// Member's settings, for all their Boards. Without it, none is offered or sent.
const sendEmails = env.RESEND_API_KEY
  ? createMailSender({
      apiKey: env.RESEND_API_KEY,
      baseUrl: env.RESEND_BASE_URL || undefined,
      onFailure: reason => console.warn(`[email-digest] not sent: ${reason}`),
    })
  : null

export const digestOffered = sendEmails !== null

// Now, in whole milliseconds (emailDigest.coveredUntil).
const nowInMs = sql<Date>`date_trunc('milliseconds', now())`

// Switched on, the first digest lists what is added from now on.
export async function switchDigestOn(userId: string): Promise<void> {
  await db.insert(emailDigest).values({ userId, coveredUntil: nowInMs }).onConflictDoNothing()
}

export async function switchDigestOff(userId: string): Promise<void> {
  await db.delete(emailDigest).where(eq(emailDigest.userId, userId))
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
// (and since they joined each Board), if there are any. What it covered is
// never listed again; a digest that didn't go out is covered by the next
// run instead.
export async function sendDigests(): Promise<DigestReport> {
  if (!sendEmails) return { covered: 0, sent: 0, failed: 0 }
  const covered = await claimCoverage()
  if (covered.length === 0) return { covered: 0, sent: 0, failed: 0 }

  let emails: Map<string, Email>
  try {
    emails = await digestEmails(covered)
  }
  catch (err) {
    // Nothing went out: the next run covers it all again.
    await uncover(covered)
    throw err
  }

  const { failed } = await sendEmails([...emails.values()])
  const notSent = new Set(failed)
  await uncover(covered.filter(c => notSent.has(emails.get(c.userId)?.to ?? '')))
  return { covered: covered.length, sent: emails.size - notSent.size, failed: notSent.size }
}

// Each digest to send, by user id: everyone with news who may still sign
// in. Someone taken off the Allowlist since gets nothing.
async function digestEmails(covered: Coverage[]): Promise<Map<string, Email>> {
  const news = await newsFor(covered)
  if (news.size === 0) return new Map()
  const recipients = await db
    .select({ id: user.id, email: user.email, name: user.username, emailVerified: user.emailVerified })
    .from(user)
    .where(inArray(user.id, [...news.keys()]))
  const origin = env.BETTER_AUTH_URL.replace(/\/+$/, '')
  return new Map(recipients
    .filter(r => !signInRefusal(r))
    .map(r => [r.id, digestEmail(r, news.get(r.id)!, origin)]))
}

// What one run covers for a Member: the Dishes added in (since, until].
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
// Dishes other Members added in what this run covers for them, newest first. Members with
// nothing new are left out.
async function newsFor(covered: Coverage[]): Promise<Map<string, BoardNews[]>> {
  const rows = await db
    .select({
      recipient: membership.userId,
      board: { id: board.id, slug: slugOf, name: board.name, emoji: board.emoji },
      title: dish.title,
      code: dish.code,
      addedBy: usernameOf,
    })
    .from(membership)
    .innerJoin(board, eq(board.id, membership.boardId))
    .innerJoin(dish, and(
      eq(dish.boardId, membership.boardId),
      isNull(dish.deletedAt),
      isNotNull(dish.addedBy),
      ne(dish.addedBy, membership.userId),
      gt(dish.createdAt, membership.joinedAt),
    ))
    .innerJoin(user, eq(user.id, dish.addedBy))
    .where(or(...covered.map(c => and(eq(membership.userId, c.userId), gt(dish.createdAt, c.since), lte(dish.createdAt, c.until)))))
    .orderBy(desc(dish.createdAt), desc(dish.id))

  const byRecipient = new Map<string, Map<string, BoardNews>>()
  for (const { recipient, board: found, ...added } of rows) {
    const boards = byRecipient.get(recipient) ?? new Map<string, BoardNews>()
    const news = boards.get(found.id) ?? { board: found, dishes: [] }
    news.dishes.push(added)
    boards.set(found.id, news)
    byRecipient.set(recipient, boards)
  }
  return new Map([...byRecipient].map(([recipient, boards]) => [
    recipient,
    [...boards.values()].toSorted((a, b) => a.board.name.localeCompare(b.board.name, 'de')),
  ]))
}
