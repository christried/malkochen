import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { user } from '../db/schema'

// A person's picture wherever the app shows them (the badges of who added or
// cooked a Dish, Members, the header): their own Profile Picture, else their
// Google photo; null for neither, and the client draws their initial.
export const pictureOf = sql<string | null>`coalesce(${user.ownPicture}, ${user.image})`

// The signed-in user as /api/me answers: who they are, the picture shown
// for them, and their own Profile Picture, if they have one (for /settings).
export interface Me {
  id: string
  name: string
  email: string
  image: string | null
  ownPicture: string | null
}

const meColumns = { id: user.id, name: user.name, email: user.email, image: pictureOf, ownPicture: user.ownPicture }

export async function findMe(userId: string): Promise<Me | null> {
  const [found] = await db.select(meColumns).from(user).where(eq(user.id, userId))
  return found ?? null
}

// Sets (or, with null, removes) the user's own Profile Picture.
export async function setOwnPicture(userId: string, url: string | null): Promise<Me | null> {
  const [updated] = await db.update(user).set({ ownPicture: url }).where(eq(user.id, userId)).returning(meColumns)
  return updated ?? null
}
