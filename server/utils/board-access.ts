import { and, eq, isNull, not, exists, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { unionAll } from 'drizzle-orm/pg-core'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { db, type Db } from '../db'
import { board, membership } from '../db/schema'
import { isOperatorUser } from './operator'
import type { Standing } from './permissions'

// The one check of who may see a Board, and with what standing (CONTEXT.md:
// Member, Operator). Every read and write that decides either asks here,
// and nowhere else: the Board routes, the Dish, Column, Comment and Cooking
// functions, Addresses, the person card and the image store all build on
// these.
//
// The Operator has an Owner's standing on every live Board (ADR 0009), and
// an Archived Board stays closed to them. On a Board they are a Member of,
// their Membership carries that standing (`isOwner` true, `ownsBoard` their
// real role); on the others, a visit flagged `asOperator`. `memberBoardsOf`
// is the way to ask only for the user's own Boards (their Board Switcher,
// their landing), never for a decision.

// The Operator on a live Board: an Owner's standing there (ADR 0009).
function operatorOn(userId: string): SQL {
  return and(isNull(board.deletedAt), isOperatorUser(userId))!
}

// The one rule of the Operator's visits (ADR 0009): the Operator on a live
// Board they have no Membership on. `boardIdColumn` is the Board's id in the
// query this goes into.
function operatorMayVisit(userId: string, boardIdColumn: AnyColumn, d: Db = db): SQL {
  return and(
    operatorOn(userId),
    not(exists(d.select({ one: sql`1` }).from(membership).where(and(eq(membership.boardId, boardIdColumn), eq(membership.userId, userId))))),
  )!
}

// The user's Memberships: an Owner's standing for the Operator, and the
// Membership's own flag as `ownsBoard`, whether the Membership is the Board's
// Owner, the one Member who can't leave. The same columns, in the same order
// and types, as the Operator's visits.
function memberRows(userId: string, boardId?: string, d: Db = db) {
  return d
    .select({
      boardId: membership.boardId,
      isOwner: sql<boolean>`(${membership.isOwner} or ${isOperatorUser(userId)})`.as('is_owner'),
      ownsBoard: sql<boolean>`${membership.isOwner}`.as('owns_board'),
      permissions: membership.permissions,
      joinedAt: membership.joinedAt,
      lastOpenedAt: membership.lastOpenedAt,
      seenAt: membership.seenAt,
      newSince: membership.newSince,
      asOperator: sql<boolean>`false`.as('as_operator'),
    })
    .from(membership)
    .where(and(eq(membership.userId, userId), boardId === undefined ? undefined : eq(membership.boardId, boardId)))
}

// Every live Board the user, if the Operator, is not a Member of.
function operatorVisits(userId: string, boardId?: string, d: Db = db) {
  return d
    .select({
      boardId: board.id,
      isOwner: sql<boolean>`true`.as('is_owner'),
      ownsBoard: sql<boolean>`false`.as('owns_board'),
      permissions: sql<typeof membership.$inferSelect.permissions>`${JSON.stringify(ALL_PERMISSIONS)}::jsonb`,
      joinedAt: sql<Date>`${board.createdAt}`,
      lastOpenedAt: sql<Date | null>`null::timestamptz`,
      seenAt: sql<Date | null>`null::timestamptz`,
      newSince: sql<Date | null>`null::timestamptz`,
      asOperator: sql<boolean>`true`.as('as_operator'),
    })
    .from(board)
    .where(and(
      operatorMayVisit(userId, board.id, d),
      boardId === undefined ? undefined : eq(board.id, boardId),
    ))
}

// The access rows of the user, on the one Board `boardId` if given. Built on
// `d`, the transaction it is part of, if any.
function accessRows(userId: string, boardId?: string, d: Db = db) {
  return unionAll(memberRows(userId, boardId, d), operatorVisits(userId, boardId, d))
}

// The user's access on the Board, as a query: to filter on with exists, or
// to read the standing from.
export function accessOn(boardId: string, userId: string, d: Db = db) {
  return accessRows(userId, boardId, d)
}

// The user's access on every Board they may see, as a subquery to join
// (aliased `access`) or to filter on.
export function accessOf(userId: string) {
  return accessRows(userId).as('access')
}

// The user's Memberships only, aliased `access`: for the user's own Boards
// (the Board Switcher, the landing), never for deciding access.
export function memberBoardsOf(userId: string) {
  return memberRows(userId).as('access')
}

// The ids of the Boards the user may see, as a single column for `inArray`.
export function accessibleBoardIds(userId: string) {
  return unionAll(
    db.select({ id: membership.boardId }).from(membership).where(eq(membership.userId, userId)),
    operatorIds(userId),
  )
}

// The ids of the Boards the user is the Owner of, for `inArray`: their own
// Owned Boards, and for the Operator every live Board.
export function ownedBoardIds(userId: string) {
  return unionAll(
    db.select({ id: membership.boardId }).from(membership).where(and(eq(membership.userId, userId), membership.isOwner)),
    db.select({ id: board.id }).from(board).where(operatorOn(userId)),
  )
}

function operatorIds(userId: string) {
  return db
    .select({ id: board.id })
    .from(board)
    .where(and(
      operatorMayVisit(userId, board.id),
    ))
}

// The user's standing on the Board, or null unless they may see it.
export async function standingOn(boardId: string, userId: string): Promise<Standing | null> {
  const [found] = await accessOn(boardId, userId)
  return found ? { isOwner: found.isOwner, permissions: found.permissions } : null
}

// Whether the user may see the Board: a Member, or the Operator.
export async function isMember(boardId: string, userId: string): Promise<boolean> {
  return (await standingOn(boardId, userId)) !== null
}

// The user's access on the Board if they are its Owner, or the Operator
// (who has an Owner's standing on every live Board), built on `d`, the
// transaction it is part of, if any.
export function ownerOf(boardId: string, userId: string, d: Db = db) {
  return unionAll(
    d
      .select({ userId: membership.userId })
      .from(membership)
      .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId), membership.isOwner)),
    d
      .select({ userId: sql<string>`${userId}::text` })
      .from(board)
      .where(and(
        eq(board.id, boardId),
        operatorOn(userId),
      )),
  )
}
