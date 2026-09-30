import { z } from 'zod'
import { lookupSource } from '../utils/source-lookup'

const query = z.object({ link: z.url({ protocol: /^https?$/ }).max(2048) })

// GET /api/source-lookup?link=… — what the Add Dish flow shows while a link is
// pasted: Source kind, Suggested Title, image and canonical link. Always
// answers 200 for a web link, with empty fields when nothing was found.
export default defineEventHandler(async (event) => {
  const parsed = query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A web link is required' })
  return lookupSource(parsed.data.link)
})
