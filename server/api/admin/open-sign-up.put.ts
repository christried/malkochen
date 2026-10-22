import { z } from 'zod'
import { switchOpenSignUp } from '../../utils/open-sign-up'
import { requireOperator } from '../../utils/operator'

const body = z.object({ on: z.boolean() })

// PUT /api/admin/open-sign-up { on } — "Anmeldung offen" on the Admin Page
// (#350): switches Open Sign-up, for the Operator only ("not found" to
// anyone else). 400 for anything but true or false.
export default defineEventHandler(async (event) => {
  requireOperator(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Not on or off' })
  await switchOpenSignUp(parsed.data.on, event.context.user!.id)
  return { on: parsed.data.on }
})
