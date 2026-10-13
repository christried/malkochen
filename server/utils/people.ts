import { and, eq, ne, sql } from 'drizzle-orm'
import type { UsernamePrompt } from '../../shared/username'
import { db } from '../db'
import { user } from '../db/schema'

// A person's picture wherever the app shows them (the badges of who added or
// cooked a Dish, Members, the header): their own Profile Picture, else their
// Google photo; null for neither, and the client draws their initial.
export const pictureOf = sql<string | null>`coalesce(${user.ownPicture}, ${user.image})`

// What stands for someone who hasn't picked a Username yet (a new user who
// followed an Invite Link is a Member before they have): never their Google
// name.
const NO_USERNAME_YET = 'Neu dabei'

// A person's name wherever the app shows them to others: their Username.
export const usernameOf = sql<string>`coalesce(${user.username}, ${NO_USERNAME_YET})`

// The signed-in user as /api/me answers: who they are (`name` is their
// Username, empty until they have one), the picture shown for them, their
// own Profile Picture, if they have one (for /settings), and what they are
// still to be asked about their Username.
export interface Me {
  id: string
  name: string
  email: string
  image: string | null
  ownPicture: string | null
  usernamePrompt: UsernamePrompt | null
}

interface Signed {
  id: string
  email: string
  image?: string | null
  ownPicture?: string | null
  username?: string | null
  usernameConfirmedAt?: Date | null
}

// The same for the signed-in user, from their session.
export function meOf(signedIn: Signed): Me {
  const { id, email, image, ownPicture, username, usernameConfirmedAt } = signedIn
  return {
    id,
    name: username ?? '',
    email,
    image: ownPicture ?? image ?? null,
    ownPicture: ownPicture ?? null,
    usernamePrompt: !username ? 'pick' : usernameConfirmedAt ? null : 'confirm',
  }
}

const meColumns = { id: user.id, email: user.email, image: user.image, ownPicture: user.ownPicture, username: user.username, usernameConfirmedAt: user.usernameConfirmedAt }

// Sets (or, with null, removes) the user's own Profile Picture.
export async function setOwnPicture(userId: string, url: string | null): Promise<Me | null> {
  const [updated] = await db.update(user).set({ ownPicture: url }).where(eq(user.id, userId)).returning(meColumns)
  return updated ? meOf(updated) : null
}

const sameUsername = (username: string) => sql`lower(${user.username}) = lower(${username})`

// Whether someone else has the Username, whatever the case.
export async function usernameTaken(userId: string, username: string): Promise<boolean> {
  const [other] = await db.select({ id: user.id }).from(user).where(and(sameUsername(username), ne(user.id, userId))).limit(1)
  return !!other
}

// Makes `username` the user's Username, and theirs for good: they aren't
// asked about it again. 'taken' if someone else got it first (the unique
// index on lower(username) decides, not usernameTaken's look before).
export async function setUsername(userId: string, username: string): Promise<Me | 'taken' | null> {
  try {
    const [updated] = await db
      .update(user)
      .set({ username, usernameConfirmedAt: sql`coalesce(${user.usernameConfirmedAt}, now())` })
      .where(eq(user.id, userId))
      .returning(meColumns)
    return updated ? meOf(updated) : null
  }
  catch (err) {
    if (isUniqueViolation(err)) return 'taken'
    throw err
  }
}

// Postgres' unique_violation, from either driver (node-postgres puts it on
// the error, Drizzle may wrap that as its cause).
function isUniqueViolation(err: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code
  return code(err) === '23505' || code((err as { cause?: unknown } | null)?.cause) === '23505'
}
