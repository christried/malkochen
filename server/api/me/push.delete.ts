import { z } from 'zod'
import { turnOffPush } from '../../utils/push'

const body = z.object({ endpoint: z.string().max(2048) })

// DELETE /api/me/push { endpoint } — turns push notifications off for this
// device (#219). Off already, or someone else's device: nothing changes.
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'An endpoint is required' })
  await turnOffPush(user.id, parsed.data.endpoint)
  setResponseStatus(event, 204)
  return null
})
