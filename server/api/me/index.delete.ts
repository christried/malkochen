import { z } from 'zod'
import { stringsFor } from '../../../app/strings'
import { typedUsername } from '../../../shared/username'
import { deleteAccount } from '../../utils/account-deletion'

const body = z.object({ username: z.string().max(200) })

// DELETE /api/me { username } — "Konto löschen" (#346, CONTEXT.md: Deleted
// Account): deletes the user's account for good, confirmed by their
// Username typed as it is (whatever the case). 400 with a message in the
// caller's language in data.message if it isn't theirs.
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const language = callerLanguage(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  const typed = typedUsername(parsed.success ? parsed.data.username : '')
  if (!user.username || typed.toLowerCase() !== user.username.toLowerCase()) {
    throw createError({ statusCode: 400, statusMessage: 'Not your Username', data: { message: stringsFor(language).deleteAccount.wrongUsername } })
  }

  await deleteAccount({ ...user, username: user.username }, language)
  setResponseStatus(event, 204)
  return null
})
