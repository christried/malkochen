import { and, eq, exists, not, sql, type SQLWrapper } from 'drizzle-orm'
import { z } from 'zod'
import { ALL_PERMISSIONS, PERMISSIONS, permitsOn, type Permission, type Permissions } from '../../shared/permissions'
import { db } from '../db'
import { board, membership } from '../db/schema'
import { ownerOf, standingOn } from './board-access'

// The one check of Permissions (CONTEXT.md): may this user do this on this
// Board, and on this Dish? Every write a Permission covers asks it before
// writing, through requirePermission and the others in
// permission-checks.ts: #340 adding Dishes, #341 editing, moving and
// archiving them, #342 the rest. The Owner may always do
// everything, whatever their stored Permissions say; a Member may always
// edit and archive the Dishes they added themselves.

// What switching Permissions sends: any of them, each on or off; at least
// one. A Member's, or the Board's Default Permissions.
export const permissionChanges = z.strictObject(Object.fromEntries(PERMISSIONS.map(p => [p, z.boolean().optional()])) as Record<Permission, z.ZodOptional<z.ZodBoolean>>)
  .refine(changes => Object.keys(changes).length > 0)

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

// The same in SQL, for a query over the user's access (board-access.ts,
// `access` by default: the Membership's row): whether the Member may take
// an action `permission` covers that isn't about one Dish.
export function permits(permission: Permission, { isOwner, permissions }: { isOwner: SQLWrapper, permissions: SQLWrapper } = membership) {
  return sql<boolean>`(${isOwner} or coalesce((${permissions} ->> ${permission})::boolean, false))`
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

// The Owner switches some of the Board's Default Permissions, which a
// Member joining through the Invite Link gets; the others stay as they are.
// Answers them all now, 'forbidden' unless the user is the Owner, or null
// for a non-Member.
export async function setDefaultPermissions(boardId: string, userId: string, changes: Partial<Permissions>): Promise<Permissions | 'forbidden' | null> {
  const standing = await standingOn(boardId, userId)
  if (!standing) return null
  if (!standing.isOwner) return 'forbidden'
  // Only while the user is still the Owner.
  const [updated] = await db
    .update(board)
    .set({ defaultPermissions: sql`${board.defaultPermissions} || ${JSON.stringify(changes)}::jsonb` })
    .where(and(eq(board.id, boardId), exists(ownerOf(boardId, userId))))
    .returning({ defaultPermissions: board.defaultPermissions })
  return updated?.defaultPermissions ?? 'forbidden'
}
