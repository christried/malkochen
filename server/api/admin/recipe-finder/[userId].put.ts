import { z } from 'zod'
import { requireOperator } from '../../../utils/operator'
import { switchRecipeFinder } from '../../../utils/recipe-finder'

const body = z.object({ on: z.boolean() })

// PUT /api/admin/recipe-finder/:userId { on } — switches the Recipe Finder
// on or off for a user (#497), asked or not, for the Operator only ("not
// found" to anyone else). 400 for anything but true or false; 404 for no
// such user.
export default defineEventHandler(async (event) => {
  requireOperator(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Not on or off' })
  const userId = getRouterParam(event, 'userId') ?? ''
  if (!await switchRecipeFinder(userId, parsed.data.on, event.context.user!.id)) {
    throw createError({ statusCode: 404, statusMessage: 'No such user' })
  }
  return { on: parsed.data.on }
})
