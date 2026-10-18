import { z } from 'zod'
import { LANGUAGE_CHOICES } from '../../../shared/language'
import { setLanguage, type Me } from '../../utils/people'

const body = z.object({ language: z.enum(LANGUAGE_CHOICES) })

// PUT /api/me/language { language } — the user's language under Sprache in
// Your Settings (#326): "auto" (follow the browser) or one malkochen speaks
// (shared/language.ts). Kept on the user, so it follows them to every
// device. 400 for anything else. Answers /api/me's answer.
export default defineEventHandler(async (event): Promise<Me> => {
  const user = requireUser(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Not a language' })
  const me = await setLanguage(user.id, parsed.data.language)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return me
})
