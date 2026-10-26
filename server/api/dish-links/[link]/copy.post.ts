import { z } from 'zod'
import { dishLinkSecret } from '../../../../shared/dish-link'
import { copyFrom, copySourceBySecret, type CopiedDish } from '../../../utils/copies'
import { dishLinkNotFound, forgetDishLink } from '../../../utils/dish-links'
import { notifyNewDish } from '../../../utils/push'

const body = z.object({ boardId: z.uuid() })

// POST /api/dish-links/:link/copy { boardId } (#403): a Copy (CONTEXT.md) of
// the Dish the link is for, on one of the user's Boards where they may add
// Dishes. Having the link is the permission to copy it: no access to the
// Dish's Board is needed. The same Copy as POST /api/dishes/:id/copy (#402),
// its event saying it came by link. The link is forgotten once it is made.
// Signed in (404 for a link no live Dish has, 403 without "add Dishes" on the
// target, 400 for the Dish's own Board).
export default defineEventHandler(async (event): Promise<CopiedDish> => {
  const secret = dishLinkSecret(getRouterParam(event, 'link') ?? '')
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A Board is required' })
  const user = requireUser(event)
  await requirePermission(parsed.data.boardId, user.id, 'addDishes')
  await spendRateLimit(user.id, 'add-dish')
  const source = secret ? await copySourceBySecret(secret) : null
  if (!source) throw dishLinkNotFound()
  const copied = await copyFrom(source, user, parsed.data.boardId, { viaLink: true })
  if (copied === null) throw dishLinkNotFound()
  if (copied === 'same-board') throw createError({ statusCode: 400, statusMessage: 'A Dish is copied to another Board' })
  await notifyNewDish(parsed.data.boardId, copied.dish.id, user.id)
  forgetDishLink(event)
  setResponseStatus(event, 201)
  return copied
})
