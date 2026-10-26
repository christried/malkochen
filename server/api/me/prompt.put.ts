import { z } from 'zod'
import { recordPromptAnswered, recordPromptShown, type Me } from '../../utils/people'

const body = z.object({
  which: z.enum(['push', 'digest']),
  answer: z.enum(['on', 'later']).optional(),
})

// PUT /api/me/prompt { which, answer? } — a Notification Prompt (CONTEXT.md,
// #407) on the Board. Without `answer` it was just shown: the time is kept
// (it stays away for 30 days whatever the answer) and prompt_shown recorded.
// With `answer` ("on" for "Einschalten", "later" for "Später") the answer is
// recorded as prompt_answered. 400 for anything else. Answers /api/me's
// answer.
export default defineEventHandler(async (event): Promise<Me> => {
  const user = requireUser(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Not a prompt' })
  const { which, answer } = parsed.data
  const me = answer ? await recordPromptAnswered(user.id, which, answer) : await recordPromptShown(user.id, which)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return me
})
