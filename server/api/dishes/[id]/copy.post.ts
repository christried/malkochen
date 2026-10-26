import { z } from 'zod'
import { copyDish, type CopiedDish } from '../../../utils/copies'
import { notifyNewDish } from '../../../utils/push'

const body = z.object({ boardId: z.uuid() })

// POST /api/dishes/:id/copy — "Kopieren": a Copy (CONTEXT.md) of the Dish
// on another Board the user may add Dishes to (`boardId`), added by them
// at the top of that Board's first Column that isn't Gekocht. The Copy takes
// the Dish's fields and a copy of its image (#402); `imageCopied: false`
// when that image could not be copied, and the Copy has its Placeholder.
// The Dish must be one the user can see; the target's Permission decides
// (403 without "add Dishes", 404 for a non-Member). A Copy onto the same
// Board is refused (400). The target's other Members who turned push on
// are notified, as for an added Dish.
export default defineEventHandler(async (event): Promise<CopiedDish> => {
  const dishId = dishIdParam(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A Board is required' })
  const user = requireUser(event)
  await requirePermission(parsed.data.boardId, user.id, 'addDishes')
  await spendRateLimit(user.id, 'add-dish')
  const copied = await copyDish(dishId, user, parsed.data.boardId)
  if (copied === null) throw dishNotFound()
  if (copied === 'same-board') throw createError({ statusCode: 400, statusMessage: 'A Dish is copied to another Board' })
  await notifyNewDish(parsed.data.boardId, copied.dish.id, user.id)
  setResponseStatus(event, 201)
  return copied
})
