import { z } from 'zod'
import { setOwnPicture, type Me } from '../../utils/people'
import { pictureTickets } from '../../utils/image-store'

const body = z.object({ url: z.string().min(1).max(2048), ticket: z.string().min(1).max(200) })

// PUT /api/me/picture { url, ticket } — makes a Profile Picture the user
// uploaded (POST /api/me/pictures) their own: shown instead of their Google
// photo, to every Member. Only with its picture ticket, so nobody sets a
// picture they didn't upload themselves (400). Answers /api/me's answer.
export default defineEventHandler(async (event): Promise<Me> => {
  const user = requireUser(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success || !pictureTickets.check(user.id, parsed.data.url, parsed.data.ticket)) {
    throw createError({ statusCode: 400, statusMessage: 'Not an uploaded picture' })
  }
  const me = await setOwnPicture(user.id, parsed.data.url)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return me
})
