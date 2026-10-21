// Permissions (CONTEXT.md): what one Member may do on a Board, each switched
// on or off for them by its Owner. A fixed set, stored per membership
// (server/db/schema.ts); the Owner always has all of them, and a Member can
// always edit and archive the Dishes they added themselves
// (server/utils/permissions.ts).
export const PERMISSIONS = [
  'addDishes',
  'editDishes',
  'moveDishes',
  'archiveDishes',
  'editColumns',
  'shareInvite',
  'commentAndVote',
  'editBoard',
] as const

export type Permission = typeof PERMISSIONS[number]

export type Permissions = Record<Permission, boolean>

// Everything allowed: what every Member had before Permissions, and what
// the Owner always has.
export const ALL_PERMISSIONS: Permissions = {
  addDishes: true,
  editDishes: true,
  moveDishes: true,
  archiveDishes: true,
  editColumns: true,
  shareInvite: true,
  commentAndVote: true,
  editBoard: true,
}

// The Permissions that also hold for a Member's own Dishes: they may always
// edit and archive the Dishes they added themselves.
const OWN_DISH_PERMISSIONS: readonly Permission[] = ['editDishes', 'archiveDishes']

// Whether a Member with `permissions` (as they hold for them: all of them
// for the Owner) may take an action `permission` covers, as `userId`, on
// `dish` if it is about one (who added it). The server's check
// (server/utils/permissions.ts) and the app's, which hides what isn't
// allowed, both ask this.
export function permitsOn(permissions: Permissions, permission: Permission, userId: string | undefined, dish?: { addedBy: string | null | undefined }): boolean {
  if (permissions[permission]) return true
  return dish !== undefined && userId !== undefined && dish.addedBy === userId && OWN_DISH_PERMISSIONS.includes(permission)
}

// The same for the user looking at a Board, as its answer says: their
// Permissions there, and which of its Members they are.
export function viewerMay(board: { permissions: Permissions, members: { id: string, isYou: boolean }[] }, permission: Permission, dish?: { addedBy: string | null | undefined }): boolean {
  return permitsOn(board.permissions, permission, board.members.find(m => m.isYou)?.id, dish)
}

// The Permissions the app enforces so far, which Board Settings shows and
// lets the Owner switch (#340, #341). The others are stored but not yet
// acted on; each joins this list with the ticket that enforces it (#342).
export const ENFORCED_PERMISSIONS = ['addDishes', 'editDishes', 'moveDishes', 'archiveDishes'] as const satisfies readonly Permission[]

export type EnforcedPermission = typeof ENFORCED_PERMISSIONS[number]
