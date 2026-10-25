import { and, eq } from 'drizzle-orm'
import { db, type Db } from '../db'
import { membership } from '../db/schema'
import type { Standing } from './permissions'

// The one check of who may see a Board, and with what standing (CONTEXT.md:
// Member, Operator). Every read and write that decides either asks here,
// and nowhere else: the Board routes, the Dish, Column, Comment and Cooking
// functions, Addresses, the person card and the image store all build on
// these. #397 (ADR 0009) lets the Operator in on every Board, so it changes
// this file and nothing else.

const accessColumns = {
  boardId: membership.boardId,
  isOwner: membership.isOwner,
  permissions: membership.permissions,
  joinedAt: membership.joinedAt,
  lastOpenedAt: membership.lastOpenedAt,
  seenAt: membership.seenAt,
  newSince: membership.newSince,
}

// The access rows of the user, on the one Board `boardId` if given. Built on
// `d`, the transaction it is part of, if any.
function accessRows(userId: string, boardId?: string, d: Db = db) {
  return d
    .select(accessColumns)
    .from(membership)
    .where(and(eq(membership.userId, userId), boardId === undefined ? undefined : eq(membership.boardId, boardId)))
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

// The ids of the Boards the user may see, as a single column for `inArray`.
export function accessibleBoardIds(userId: string) {
  return db.select({ id: membership.boardId }).from(membership).where(eq(membership.userId, userId))
}

// The ids of the Boards the user is the Owner of, for `inArray`.
export function ownedBoardIds(userId: string) {
  return db.select({ id: membership.boardId }).from(membership).where(and(eq(membership.userId, userId), membership.isOwner))
}

// The user's standing on the Board, or null unless they may see it.
export async function standingOn(boardId: string, userId: string): Promise<Standing | null> {
  const [found] = await accessOn(boardId, userId)
  return found ? { isOwner: found.isOwner, permissions: found.permissions } : null
}

// Whether the user may see the Board, as a Member.
export async function isMember(boardId: string, userId: string): Promise<boolean> {
  return (await standingOn(boardId, userId)) !== null
}

// The user's access on the Board if they are its Owner, built on `d`, the
// transaction it is part of, if any.
export function ownerOf(boardId: string, userId: string, d: Db = db) {
  return d
    .select({ userId: membership.userId })
    .from(membership)
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId), membership.isOwner))
}
