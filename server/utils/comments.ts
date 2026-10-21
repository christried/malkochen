import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { COMMENT_MAX } from '../../app/utils/comment-text'
import { db } from '../db'
import { comment, dish, membership, user } from '../db/schema'
import type { DishAdder } from './dishes'
import { commentEvent, withEvents } from './events'
import { pictureOf } from './people'

// Comments (CONTEXT.md: Comment): a Member's message on a Dish, in its Dish
// History (dish-history.ts). Any Member writes one; its author changes its
// text (then "bearbeitet") and deletes it, the Board's Owner deletes any.
// Deleting is soft, so "Rückgängig" can bring it back; the daily cleanup
// purges it after RESTORABLE_FOR (cleanup.ts). Every write records its event.

export interface CommentView {
  id: string
  text: string
  createdAt: string
  // When its author last changed its text ("bearbeitet"); null if never.
  editedAt: string | null
  // Null once their account is gone ("Gelöschtes Konto").
  author: DishAdder | null
}

// What writing or editing one accepts: trimmed, never empty, at most
// COMMENT_MAX characters.
export const commentBody = z.object({ text: z.string().trim().min(1).max(COMMENT_MAX) })

// Why a Member may not change a Comment they can see: to edit it, it must
// be theirs; to delete or restore it, theirs or on a Board they own.
export type CommentRefusal = 'forbidden'

function selectComments() {
  return db
    .select({
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      authorId: user.id,
      // Writing one takes a Username (server/middleware/auth.ts).
      authorName: user.username,
      authorImage: pictureOf,
    })
    .from(comment)
    .leftJoin(user, eq(user.id, comment.authorId))
    .$dynamic()
}

type CommentRow = Awaited<ReturnType<typeof selectComments>>[number]

function toView({ authorId, authorName, authorImage, ...row }: CommentRow): CommentView {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    author: authorId ? { id: authorId, name: authorName ?? '', image: authorImage } : null,
  }
}

// A Dish's Comments, oldest first, without the deleted ones.
export async function commentsOfDish(dishId: string): Promise<CommentView[]> {
  const rows = await selectComments()
    .where(and(eq(comment.dishId, dishId), isNull(comment.deletedAt)))
    .orderBy(asc(comment.createdAt), asc(comment.id))
  return rows.map(toView)
}

// How many Comments each of the given Dishes has, without the deleted ones.
export async function commentCountsByDish(dishIds: string[]): Promise<Map<string, number>> {
  if (dishIds.length === 0) return new Map()
  const rows = await db
    .select({ dishId: comment.dishId, count: sql<number>`count(*)::int` })
    .from(comment)
    .where(and(inArray(comment.dishId, dishIds), isNull(comment.deletedAt)))
    .groupBy(comment.dishId)
  return new Map(rows.map(r => [r.dishId, r.count]))
}

// The Dishes on a Board the user is a Member of (its Owner, `owning`), not
// archived.
function membersDishes(userId: string, { owning = false } = {}) {
  return db
    .select({ id: dish.id })
    .from(dish)
    .innerJoin(membership, and(
      eq(membership.boardId, dish.boardId),
      eq(membership.userId, userId),
      owning ? membership.isOwner : undefined,
    ))
    .where(isNull(dish.deletedAt))
}

// The Comment, if the user may see it: on a Dish of a Board they are a
// Member of, not archived. A deleted one counts only `includingDeleted`.
function seenBy(commentId: string, userId: string, { includingDeleted = false } = {}) {
  return and(
    eq(comment.id, commentId),
    includingDeleted ? undefined : isNull(comment.deletedAt),
    inArray(comment.dishId, membersDishes(userId)),
  )
}

// Whether the user may delete (and bring back) the Comment: it is theirs,
// or on a Board they own.
function deletableBy(userId: string) {
  return or(eq(comment.authorId, userId), inArray(comment.dishId, membersDishes(userId, { owning: true })))
}

async function findComment(where: ReturnType<typeof and>): Promise<CommentView | null> {
  const [row] = await selectComments().where(where)
  return row ? toView(row) : null
}

// Writes a Comment on a Dish, by the user. Null unless the Dish is on a
// Board they are a Member of and not archived.
export async function writeComment(dishId: string, userId: string, text: string): Promise<CommentView | null> {
  const { rows } = await withEvents(
    db,
    // Drizzle's insert … select wants every column selected.
    sql`insert into ${comment} (dish_id, author_id, text)
      select ${dish.id}, ${userId}::text, ${text}::text from ${dish}
      where ${and(eq(dish.id, dishId), inArray(dish.id, membersDishes(userId)))}
      returning id, dish_id`,
    commentEvent('comment_written', userId),
  )
  const [written] = rows as { id: string }[]
  return written ? findComment(eq(comment.id, written.id)) : null
}

// Changes the text of the user's own Comment; it is "bearbeitet" from then
// on, unless the text stays the same. Null if they can't see it.
export async function editComment(commentId: string, userId: string, text: string): Promise<CommentView | CommentRefusal | null> {
  const target = seenBy(commentId, userId)
  const [found] = await db.select({ authorId: comment.authorId }).from(comment).where(target)
  if (!found) return null
  if (found.authorId !== userId) return 'forbidden'
  await withEvents(
    db,
    db.update(comment)
      .set({ text, editedAt: sql`case when ${comment.text} = ${text} then ${comment.editedAt} else now() end` })
      .where(and(target, eq(comment.authorId, userId)))
      .returning({ id: comment.id, dishId: comment.dishId }),
    commentEvent('comment_edited', userId),
    // Recorded only when the text changed.
    { earlier: sql`select ${comment.id} from ${comment} where ${and(target, ne(comment.text, text))}` },
  )
  return findComment(target)
}

// Deletes a Comment: the user's own, or any on a Board they own. A soft
// delete, so restoreComment can bring it back. Null if they can't see it.
export async function deleteComment(commentId: string, userId: string): Promise<'deleted' | CommentRefusal | null> {
  const target = seenBy(commentId, userId)
  const { rows } = await withEvents(
    db,
    db.update(comment).set({ deletedAt: new Date() }).where(and(target, deletableBy(userId))).returning({ id: comment.id, dishId: comment.dishId }),
    commentEvent('comment_deleted', userId),
  )
  if (rows.length > 0) return 'deleted'
  const [found] = await db.select({ id: comment.id }).from(comment).where(target)
  return found ? 'forbidden' : null
}

// "Rückgängig" after deleting a Comment: it is back as it was. Whoever may
// delete it may bring it back; restoring one that isn't deleted changes
// nothing. Null if they can't see it, or it has been purged.
export async function restoreComment(commentId: string, userId: string): Promise<CommentView | CommentRefusal | null> {
  const target = seenBy(commentId, userId, { includingDeleted: true })
  const [found] = await db.select({ id: comment.id }).from(comment).where(target)
  if (!found) return null
  const { rows } = await withEvents(
    db,
    db.update(comment).set({ deletedAt: null }).where(and(target, deletableBy(userId))).returning({ id: comment.id, dishId: comment.dishId }),
    commentEvent('comment_restored', userId),
    // Recorded only for one that was deleted.
    { earlier: sql`select ${comment.id} from ${comment} where ${and(target, isNotNull(comment.deletedAt))}` },
  )
  if (rows.length === 0) return 'forbidden'
  return findComment(target)
}
