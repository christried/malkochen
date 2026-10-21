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

// The Permissions the app enforces so far, which Board Settings shows and
// lets the Owner switch (#340). The others are stored but not yet acted on;
// each joins this list with the ticket that enforces it (#341, #342).
export const ENFORCED_PERMISSIONS = ['addDishes'] as const satisfies readonly Permission[]

export type EnforcedPermission = typeof ENFORCED_PERMISSIONS[number]
