import { z } from 'zod'
import { PERMISSIONS, type Permission, type Permissions } from '../../../../../../shared/permissions'
import { setPermissions, type PermissionsRefusal } from '../../../../../utils/permissions'

// Any of the Permissions, each on or off; at least one.
const body = z.strictObject(Object.fromEntries(PERMISSIONS.map(p => [p, z.boolean().optional()])) as Record<Permission, z.ZodOptional<z.ZodBoolean>>)
  .refine(changes => Object.keys(changes).length > 0)

const REFUSED = {
  'forbidden': { statusCode: 403, statusMessage: 'Only the Owner can change Permissions' },
  'owner': { statusCode: 400, statusMessage: 'The Owner always has every Permission' },
  'not-member': { statusCode: 404, statusMessage: 'Member not found' },
} satisfies Record<PermissionsRefusal, { statusCode: number, statusMessage: string }>

// PATCH /api/boards/:id/members/:userId/permissions { addDishes?, … } — the
// Owner switches a Member's Permissions; those not sent stay as they are.
// Answers all of the Member's Permissions.
export default defineEventHandler(async (event): Promise<Permissions> => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Say which Permissions to switch, each true or false' })
  const result = await setPermissions(boardId, requireUser(event).id, getRouterParam(event, 'userId') ?? '', parsed.data)
  if (!result) throw boardNotFound()
  if (typeof result === 'string') throw createError(REFUSED[result])
  return result
})
