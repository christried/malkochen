import { and, eq, exists, inArray, not, sql } from 'drizzle-orm'
import { ALL_PERMISSIONS, permitsOn, type Permission, type Permissions } from '../../shared/permissions'
import { db } from '../db'
import { boardColumn, cooking, dish, membership } from '../db/schema'
import { ownerOf } from './boards'

// The one check of Permissions (CONTEXT.md): may this user do this on this
// Board, and on this Dish? Every write a Permission covers asks it before
// writing, through requirePermission (server/utils/session.ts): #340
// adding Dishes, #341 and #342 the rest. The Owner may always do
// everything, whatever their stored Permissions say; a Member may always
// edit and archive the Dishes they added themselves.

// A Member's standing on a Board: whether they are its Owner, and their
// stored Permissions.
export interface Standing {
  isOwner: boolean
  permissions: Permissions
}

// What the Member may do, as the app shows it: everything for the Owner,
// else their stored Permissions.
export function effectivePermissions({ isOwner, permissions }: Standing): Permissions {
  return isOwner ? ALL_PERMISSIONS : permissions
}

// Whether a Member standing so may take an action `permission` covers, on
// `dish` if it is about one (who added it).
export function allows(standing: Standing, permission: Permission, userId: string, dish?: { addedBy: string | null }): boolean {
  return permitsOn(effectivePermissions(standing), permission, userId, dish)
}

// The same in SQL, for a query over memberships: whether the Member may
// take an action `permission` covers that isn't about one Dish.
export function permits(permission: Permission) {
  return sql<boolean>`(${membership.isOwner} or coalesce((${membership.permissions} ->> ${permission})::boolean, false))`
}

// The user's standing on the Board, or null unless they are a Member.
export async function standingOn(boardId: string, userId: string): Promise<Standing | null> {
  const [found] = await db
    .select({ isOwner: membership.isOwner, permissions: membership.permissions })
    .from(membership)
    .where(and(eq(membership.boardId, boardId), eq(membership.userId, userId)))
  return found ?? null
}

// A Dish as the check sees it: its Board, who added it, and the user's
// standing on that Board.
export interface DishStanding extends Standing {
  boardId: string
  addedBy: string | null
}

// Each of the Dishes `dishIds` on a Board the user is a Member of, archived
// ones too. Those missing, or on a Board the user isn't a Member of, aren't
// there: the write itself answers "not found" for them.
export function dishStandings(dishIds: string[], userId: string): Promise<DishStanding[]> {
  return db
    .select({ boardId: dish.boardId, addedBy: dish.addedBy, isOwner: membership.isOwner, permissions: membership.permissions })
    .from(dish)
    .innerJoin(membership, and(eq(membership.boardId, dish.boardId), eq(membership.userId, userId)))
    .where(inArray(dish.id, dishIds))
}

// The Dish of a Cooking, deleted or not, as dishStandings sees it.
export async function cookingDishStanding(cookingId: string, userId: string): Promise<DishStanding | null> {
  const [found] = await db
    .select({ boardId: dish.boardId, addedBy: dish.addedBy, isOwner: membership.isOwner, permissions: membership.permissions })
    .from(cooking)
    .innerJoin(dish, eq(dish.id, cooking.dishId))
    .innerJoin(membership, and(eq(membership.boardId, dish.boardId), eq(membership.userId, userId)))
    .where(eq(cooking.id, cookingId))
  return found ?? null
}

// The Boards of the Columns `columnIds`, of those that exist.
export async function boardsOfColumns(columnIds: string[]): Promise<string[]> {
  const found = await db.selectDistinct({ boardId: boardColumn.boardId }).from(boardColumn).where(inArray(boardColumn.id, columnIds))
  return found.map(c => c.boardId)
}

// Why a Member's Permissions couldn't be switched: the user isn't the
// Owner ('forbidden'), the Member is the Owner, who always has every one
// ('owner'), or nobody by that id is on the Board ('not-member').
export type PermissionsRefusal = 'forbidden' | 'owner' | 'not-member'

// The Owner switches some of a Member's Permissions; the others stay as
// they are. Answers the Member's Permissions now, or null for a non-Member.
export async function setPermissions(boardId: string, userId: string, memberId: string, changes: Partial<Permissions>): Promise<Permissions | PermissionsRefusal | null> {
  const standing = await standingOn(boardId, userId)
  if (!standing) return null
  if (!standing.isOwner) return 'forbidden'
  if (memberId === userId) return 'owner'
  // Merged into what is stored, only while the user is still the Owner.
  // Setting flags to what they are already moves no Board Version: its
  // trigger (migration 0033) only counts Permissions that differ.
  const [updated] = await db
    .update(membership)
    .set({ permissions: sql`${membership.permissions} || ${JSON.stringify(changes)}::jsonb` })
    .where(and(
      eq(membership.boardId, boardId),
      eq(membership.userId, memberId),
      not(membership.isOwner),
      exists(ownerOf(boardId, userId)),
    ))
    .returning({ permissions: membership.permissions })
  if (updated) return updated.permissions
  // Nothing changed: the Member is gone, or the user handed over meanwhile.
  return (await standingOn(boardId, userId))?.isOwner ? 'not-member' : 'forbidden'
}
