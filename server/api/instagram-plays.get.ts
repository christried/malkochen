import { z } from 'zod'
import { instagramPlaysInPlace } from '../utils/source-lookup'

const query = z.object({ link: z.url({ protocol: /^https?$/ }).max(2048) })

// GET /api/instagram-plays?link=… — whether Instagram's embed plays an
// Instagram Dish's video in place (#279), asked by the Dish detail before it
// offers "Video abspielen". `playsInPlace` is false for a Reel Instagram
// only shows with "Auf Instagram ansehen", null when that isn't known (the
// player then finds out itself). Kept by the browser for an hour; 429 over
// the user's limit (server/rate-limits.ts).
export default defineEventHandler(async (event) => {
  const parsed = query.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'A web link is required' })
  const user = requireUser(event)
  await spendRateLimit(user.id, 'instagram-plays')
  const playsInPlace = await instagramPlaysInPlace(parsed.data.link)
  setHeader(event, 'cache-control', 'private, max-age=3600')
  return { playsInPlace }
})
