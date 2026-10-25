import { z } from 'zod'
import { imageTickets } from '../utils/image-store'
import { issueSourceTicket } from '../utils/source-ticket'
import { lookupSource } from '../utils/source-lookup'

const query = z.object({ link: z.url({ protocol: /^https?$/ }).max(2048) })

// GET /api/source-lookup?link=… — what the Add Dish flow shows while a link is
// pasted: Source kind, Suggested Title, image and canonical link, plus an
// Image Ticket for the image, which saving the Dish needs to copy it, and a
// Source Ticket for the link and Caption it read, which saving the Dish needs
// to keep the Caption (even when there is none: the ticket then vouches for
// that). Always answers 200 for a web link, with empty fields when nothing was
// found; 429 over the user's limit (server/rate-limits.ts).
export default defineEventHandler(async (event) => {
  const parsed = query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A web link is required' })
  const user = requireUser(event)
  await spendRateLimit(user.id, 'source-lookup')
  const result = await lookupSource(parsed.data.link)
  const imageTicket = result.imageUrl ? imageTickets.issue(user.id, result.imageUrl) : null
  return { ...result, imageTicket, sourceTicket: issueSourceTicket(user.id, result) }
})
