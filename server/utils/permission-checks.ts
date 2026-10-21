import { and, eq, inArray } from 'drizzle-orm'
import type { Permission } from '../../shared/permissions'
import { db } from '../db'
import { boardColumn, cooking, dish, membership } from '../db/schema'
import { allows, standingOn, type Standing } from './permissions'
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

// Throws 403 unless the user may take an action `permission` covers on
// each of the Dishes `dishIds`, archived ones too. One the user can't see
// is left to the write, which answers "not found" for it.
export async function requireDishPermission(dishIds: string | string[], userId: string, permission: Permission): Promise<void> {
  const found = await dishesSeenBy(userId).where(inArray(dish.id, typeof dishIds === 'string' ? [dishIds] : dishIds))
  if (found.some(f => !allows(f, permission, userId, f))) throw notPermitted(permission)
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
  if (found.some(f => !allows(f, 'moveDishes', userId, f))) throw notPermitted('moveDishes')
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
  return db
    .select({ boardId: dish.boardId, addedBy: dish.addedBy, isOwner: membership.isOwner, permissions: membership.permissions })
    .from(dish)
    .innerJoin(membership, and(eq(membership.boardId, dish.boardId), eq(membership.userId, userId)))
}

// The Boards of the Columns `columnIds`, of those that exist.
async function boardsOfColumns(columnIds: string[]): Promise<string[]> {
  const found = await db.selectDistinct({ boardId: boardColumn.boardId }).from(boardColumn).where(inArray(boardColumn.id, columnIds))
  return found.map(c => c.boardId)
}
