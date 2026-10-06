import { boardAddress, type BoardAddress } from '../../utils/addresses'

// GET /api/addresses/:board?dish=<Dish part> — where a Board's address
// leads (CONTEXT.md: Address): any slug the Board had, or its id, and
// optionally a Dish's part of the address (by its code, or its id). The page
// at an outdated address forwards to the current one before it opens the
// Board. For a non-Member, the same 404 as for an address no Board has.
export default defineEventHandler(async (event): Promise<BoardAddress> => {
  const ref = getRouterParam(event, 'board', { decode: true }) ?? ''
  const { dish } = getQuery(event)
  const found = await boardAddress(ref, requireUser(event).id, typeof dish === 'string' ? dish : undefined)
  if (!found) throw boardNotFound()
  return found
})
