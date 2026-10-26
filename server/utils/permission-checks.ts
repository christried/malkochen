import { eq, inArray } from 'drizzle-orm'
import type { Permission } from '../../shared/permissions'
import { db } from '../db'
import { boardColumn, comment, cooking, dish } from '../db/schema'
import { accessOf, standingOn } from './board-access'
import { allows, type Standing } from './permissions'
import { boardNotFound } from './session'

// The checks every write a Permission covers makes before writing
// (permissions.ts decides): each throws, 404 or 403, unless the user may.

// Throws unless the user may take an action `permission` covers on the
// Board, on `dish` if it is about one: 404 for a non-Member, as
// boardNotFound; 403 for a Member without the Permission (notPermitted).
export async function requirePermission(boardId: string, userId: string, permission: Permission, dish?: { addedBy: string | null }): Promise<void> {
  const standing = await standingOn(boardId, userId)
  if (!standing) throw boardNotFound()
  if (!allows(standing, permission, userId, dish)) throw notPermitted(permission)
}

// The refusal for a Member without a Permission: 403, with the Permission
// it needs, which the app names kindly.
function notPermitted(permission: Permission) {
  return createError({ statusCode: 403, statusMessage: 'Not permitted on this Board', data: { permission } })
}

// Throws 403 unless each of the standings `found` allows an action
// `permission` covers, on its Dish if it is one (who added it).
function requireEach(found: (Standing & { addedBy?: string | null })[], userId: string, permission: Permission) {
  if (found.some(f => !allows(f, permission, userId, f.addedBy === undefined ? undefined : { addedBy: f.addedBy }))) throw notPermitted(permission)
}

// Throws 403 unless the user may take an action `permission` covers on
// each of the Dishes `dishIds`, archived ones too. One the user can't see
// is left to the write, which answers "not found" for it.
export async function requireDishPermission(dishIds: string | string[], userId: string, permission: Permission): Promise<void> {
  requireEach(await dishesSeenBy(userId).where(inArray(dish.id, typeof dishIds === 'string' ? [dishIds] : dishIds)), userId, permission)
}

// Throws 403 unless the user may take an action `permission` covers on the
// Board of the Column `columnId`. One the user can't see is left to the
// write, which answers "not found" for it.
export async function requireColumnPermission(columnId: string, userId: string, permission: Permission): Promise<void> {
  const access = accessOf(userId)
  const found = await db
    .select({ isOwner: access.isOwner, permissions: access.permissions })
    .from(boardColumn)
    .innerJoin(access, eq(access.boardId, boardColumn.boardId))
    .where(eq(boardColumn.id, columnId))
  requireEach(found, userId, permission)
}

// The same for the Dish of the Comment `commentId`, deleted or not.
export async function requireCommentPermission(commentId: string, userId: string, permission: Permission): Promise<void> {
  requireEach(await dishesSeenBy(userId).innerJoin(comment, eq(comment.dishId, dish.id)).where(eq(comment.id, commentId)), userId, permission)
}

// Throws 403 unless the user may move the Dishes `dishIds` into the
// Columns `columnIds`, as requireMoves says.
export async function requireMovePermission(dishIds: string[], userId: string, columnIds: string[], { back = false } = {}): Promise<void> {
  await requireMoves(await dishesSeenBy(userId).where(inArray(dish.id, dishIds)), userId, columnIds, { back })
}

// The same for the Dish of a Cooking, deleted or not: taking the Cooking
// back moves the Dish back (to `columnIds`), and deleting or restoring it
// changes what the Gekocht Column says about it, all of which "move
// Dishes" covers.
export async function requireCookingPermission(cookingId: string, userId: string, columnIds: string[] = []): Promise<void> {
  const found = await dishesSeenBy(userId).innerJoin(cooking, eq(cooking.dishId, dish.id)).where(eq(cooking.id, cookingId))
  await requireMoves(found, userId, columnIds, { back: true })
}

// Throws 403 unless the user may move each of the Dishes `found` into the
// Columns `columnIds`: "move Dishes" for each, never its own without it;
// and on a Column's Board that one of them isn't on, "add Dishes", as it
// adds a Dish there. Putting Dishes back where they came from (`back`:
// "Rückgängig") takes "move Dishes" there instead, as moving them away did.
async function requireMoves(found: DishSeen[], userId: string, columnIds: string[], { back = false } = {}) {
  requireEach(found, userId, 'moveDishes')
  const needed = back ? 'moveDishes' : 'addDishes'
  for (const boardId of await boardsOfColumns(columnIds)) {
    if (found.every(f => f.boardId === boardId)) continue
    const standing = await standingOn(boardId, userId)
    // A Board the user isn't a Member of the write refuses itself.
    if (standing && !allows(standing, needed, userId)) throw notPermitted(needed)
  }
}

// A Dish as the check sees it: its Board, who added it, and the user's
// standing on that Board.
interface DishSeen extends Standing {
  boardId: string
  addedBy: string | null
}

// The Dishes on Boards the user is a Member of, archived ones too, as the
// check sees them; to narrow with `where`. Those missing, or on a Board
// the user isn't a Member of, aren't there: the write itself answers "not
// found" for them.
function dishesSeenBy(userId: string) {
  const access = accessOf(userId)
  return db
    .select({ boardId: dish.boardId, addedBy: dish.addedBy, isOwner: access.isOwner, permissions: access.permissions })
    .from(dish)
    .innerJoin(access, eq(access.boardId, dish.boardId))
}

// The Boards of the Columns `columnIds`, of those that exist.
async function boardsOfColumns(columnIds: string[]): Promise<string[]> {
  const found = await db.selectDistinct({ boardId: boardColumn.boardId }).from(boardColumn).where(inArray(boardColumn.id, columnIds))
  return found.map(c => c.boardId)
}
