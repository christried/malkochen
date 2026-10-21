import type { Permissions } from '../../../../shared/permissions'
import { permissionChanges, setDefaultPermissions } from '../../../utils/permissions'

// PATCH /api/boards/:id/default-permissions { addDishes?, … } — the Owner
// switches the Board's Default Permissions, which a Member joining through
// the Invite Link gets; those not sent stay as they are. Answers all of them.
export default defineEventHandler(async (event): Promise<Permissions> => {
  const boardId = boardIdParam(event)
  const parsed = permissionChanges.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Say which Permissions to switch, each true or false' })
  const result = await setDefaultPermissions(boardId, requireUser(event).id, parsed.data)
  if (!result) throw boardNotFound()
  if (result === 'forbidden') throw createError({ statusCode: 403, statusMessage: 'Only the Owner can change the Default Permissions' })
  return result
})
