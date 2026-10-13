import { z } from 'zod'
import { de } from '../../../app/strings/de'
import { typedUsername, usernameProblem } from '../../../shared/username'
import { meOf, setUsername, usernameTaken, type Me } from '../../utils/people'

const body = z.object({ username: z.string().max(200) })

// Why a Username wasn't set, in the words the app shows as they are
// (app/strings/de.ts): the server is the one place the rules hold for good.
function refusal(statusCode: number, statusMessage: string, message: string) {
  return createError({ statusCode, statusMessage, data: { message } })
}

const taken = () => refusal(409, 'Username taken', de.username.taken)

// PUT /api/me/username { username } — sets the user's Username (CONTEXT.md):
// the first one a new user picks, a change in their settings, or the one
// they have, kept ("Passt dein Name?"). Either way they aren't asked again.
// 400 if it breaks the rules (shared/username.ts), 409 if someone else has
// it whatever the case, 429 after 10 changes in a day; each with a German
// message in data.message. Answers /api/me's answer.
export default defineEventHandler(async (event): Promise<Me> => {
  const user = requireUser(event)
  const parsed = body.safeParse(await readBody(event).catch(() => null))
  const username = typedUsername(parsed.success ? parsed.data.username : '')
  const problem = usernameProblem(username)
  if (problem) throw refusal(400, 'Not a Username', de.username.problem[problem])

  // Keeping the one they have isn't a change: it only ends the question.
  if (username === user.username) {
    if (user.usernameConfirmedAt) return meOf(user)
  }
  else {
    if (await usernameTaken(user.id, username)) throw taken()
    // Counted after the checks, so a refused name doesn't use up the limit.
    await spendRateLimit(user.id, 'username').catch((err: { statusCode?: number }) => {
      throw err.statusCode === 429 ? refusal(429, 'Too many requests', de.username.tooMany) : err
    })
  }

  const me = await setUsername(user.id, username)
  if (me === 'taken') throw taken()
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return me
})
