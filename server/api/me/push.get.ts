import { z } from 'zod'
import { isPushOn } from '../../utils/push'

const query = z.object({ endpoint: z.string().max(2048) })

// GET /api/me/push?endpoint=… — whether the user turned push notifications
// on for this device (#219), which their settings show. A device signed in to
// by someone else since is not on for them.
export default defineEventHandler(async (event): Promise<{ on: boolean }> => {
  const user = requireUser(event)
  const parsed = query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'An endpoint is required' })
  return { on: await isPushOn(user.id, parsed.data.endpoint) }
})
