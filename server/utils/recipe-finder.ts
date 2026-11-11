import { desc, eq, sql } from 'drizzle-orm'
import type { AdminRecipeFinderUser, RecipeFinderState } from '../../shared/recipe-finder'
import { db } from '../db'
import { recipeFinder, user } from '../db/schema'
import { recipeFinderAskedEmail } from '../email'
import { parseServerEnv } from '../env'
import { detailsOf, userEvent, withEvents } from './events'
import { mailSender } from './mail'
import { operatorEmail } from './operator'
import { recipientLanguage } from './people'

// The Recipe Finder switch (CONTEXT.md, #497, ADR 0013): off for every new
// user (no row), asked once they asked in Your Settings, on once the
// Operator switched it on. Only the Operator switches it, on or back off; a
// request they don't grant simply stays asked. It goes with the user when
// their account is deleted (on delete cascade).

const env = parseServerEnv(process.env)

// The Operator's note of a request, when the Resend API key is set.
const sendEmails = mailSender(reason => console.warn(`[recipe-finder] request not mailed: ${reason}`))

export async function recipeFinderStateOf(userId: string): Promise<RecipeFinderState> {
  const [row] = await db.select().from(recipeFinder).where(eq(recipeFinder.userId, userId))
  if (!row) return { state: 'off' }
  if (row.switchedOn) return { state: 'on' }
  return { state: 'asked', askedAt: row.askedAt!.toISOString() }
}

// The Operator hears of a request by email, in their language, naming the
// user by their Username (their email address before they picked one).
async function mailOperator(name: string): Promise<void> {
  if (!sendEmails || operatorEmail === '') return
  const [operator] = await db
    .select({ language: user.language, browserLanguage: user.browserLanguage })
    .from(user)
    .where(sql`lower(${user.email}) = ${operatorEmail}`)
  const language = recipientLanguage({ language: operator?.language ?? null, browserLanguage: operator?.browserLanguage ?? null })
  const origin = env.BETTER_AUTH_URL.replace(/\/+$/, '')
  await sendEmails([recipeFinderAskedEmail({ email: operatorEmail, language }, name, origin)])
}

// "Zugang anfragen": moves the user from off to asked, which the event log
// records and the Operator is emailed about. Asked or on already: nothing
// changes, nothing is sent. Answers the state after.
export async function askForRecipeFinder(asker: { id: string, email: string, username?: string | null }): Promise<RecipeFinderState> {
  const { rows } = await withEvents(
    db,
    db.insert(recipeFinder).values({ userId: asker.id, askedAt: new Date() }).onConflictDoNothing().returning({ userId: recipeFinder.userId }),
    userEvent('recipe_finder_asked', asker.id),
  )
  if (rows.length > 0) await mailOperator(asker.username || asker.email)
  return recipeFinderStateOf(asker.id)
}

// The Operator (`operatorId`) switches the Recipe Finder on or off for
// `userId`, asked or not. Switched off, the user is off: their request is
// gone with it. Already so: nothing changes, nothing is recorded. false
// when there is no such user.
export async function switchRecipeFinder(userId: string, on: boolean, operatorId: string): Promise<boolean> {
  const [exists] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId))
  if (!exists) return false
  const event = userEvent('recipe_finder_switched', operatorId, detailsOf({ member: userId, on }))
  if (on) {
    await withEvents(
      db,
      db.insert(recipeFinder).values({ userId, switchedOn: true })
        .onConflictDoUpdate({ target: recipeFinder.userId, set: { switchedOn: true }, setWhere: eq(recipeFinder.switchedOn, false) })
        .returning({ userId: recipeFinder.userId }),
      event,
    )
  }
  else {
    await withEvents(db, db.delete(recipeFinder).where(eq(recipeFinder.userId, userId)).returning({ userId: recipeFinder.userId }), event)
  }
  return true
}

// Everyone who asked or has it, for the Admin Page: the requests first,
// newest first, then those who have it.
export async function recipeFinderUsers(): Promise<AdminRecipeFinderUser[]> {
  const rows = await db
    .select({ id: user.id, name: user.username, switchedOn: recipeFinder.switchedOn, askedAt: recipeFinder.askedAt })
    .from(recipeFinder)
    .innerJoin(user, eq(user.id, recipeFinder.userId))
    .orderBy(recipeFinder.switchedOn, desc(recipeFinder.askedAt), user.username)
  return rows.map(row => ({
    id: row.id,
    name: row.name ?? '',
    state: row.switchedOn ? 'on' : 'asked',
    askedAt: row.askedAt?.toISOString() ?? null,
  }))
}
