import { z } from 'zod'
import { recordTourSeen, type Me } from '../../utils/people'

const body = z.object({ version: z.number().int().min(1).max(1000) })

// PUT /api/me/tour { version } — the user finished or skipped that Tour
// (CONTEXT.md → Tour), on whichever device: it doesn't start by itself again
// until a higher version. Never lowers the version kept. 400 for anything
// but a whole number from 1. Answers /api/me's answer.
export default defineEventHandler(async (event): Promise<Me> => {
  const user = requireUser(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Not a Tour version' })
  const me = await recordTourSeen(user.id, parsed.data.version)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return me
})
