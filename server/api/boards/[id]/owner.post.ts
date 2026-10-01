import { z } from 'zod'
import { handOver, type HandOverRefusal } from '../../../utils/members'

const body = z.strictObject({ userId: z.string().min(1) })

const REFUSED = {
  'forbidden': { statusCode: 403, statusMessage: 'Only the Owner can hand over ownership' },
  'self': { statusCode: 400, statusMessage: 'Already the Owner' },
  'not-member': { statusCode: 404, statusMessage: 'Member not found' },
} satisfies Record<HandOverRefusal, { statusCode: number, statusMessage: string }>

// POST /api/boards/:id/owner { userId } — the Owner hands ownership to
// another Member and stays on as a Member.
export default defineEventHandler(async (event) => {
  const boardId = boardIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Say which Member becomes the Owner' })
  const result = await handOver(boardId, requireUser(event).id, parsed.data.userId)
  if (!result) throw boardNotFound()
  if (result !== 'handed-over') throw createError(REFUSED[result])
  setResponseStatus(event, 204)
  return null
})
