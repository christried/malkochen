import { and, eq, ne, sql } from 'drizzle-orm'
import { stringsFor } from '../../app/strings'
import { newerVersion } from '../../shared/changelog'
import { chooseLanguage, languageChoice, type Language, type LanguageChoice } from '../../shared/language'
import type { UsernamePrompt } from '../../shared/username'
import { db } from '../db'
import { APP_VERSION } from '../version'
import { user } from '../db/schema'
import { isOperator } from './operator'

// A person's picture wherever the app shows them (the badges of who added or
// cooked a Dish, Members, the header): their own Profile Picture, else their
// Google photo; null for neither, and the client draws their initial.
export const pictureOf = sql<string | null>`coalesce(${user.ownPicture}, ${user.image})`

// A person's name wherever the app shows them to others: their Username,
// never their Google name. Someone who hasn't picked one yet (a new user who
// followed an Invite Link is a Member before they have) shows as "Neu dabei",
// in the `language` of whoever looks.
export const usernameOf = (language: Language) => sql<string>`coalesce(${user.username}, ${stringsFor(language).username.none})`

// The signed-in user as /api/me answers: who they are (`name` is their
// Username, empty until they have one), the picture shown for them, their
// own Profile Picture, if they have one (for their settings), and what they are
// still to be asked about their Username, the highest Tour version they
// finished or skipped (null for none), their language under Sprache,
// whether they are the Operator, who has the Admin Page (#348), the app's
// Version (empty before 1.0.0) and whether it is newer than the last one they opened the Changelog in
// (#354).
export interface Me {
  id: string
  name: string
  email: string
  image: string | null
  ownPicture: string | null
  usernamePrompt: UsernamePrompt | null
  tourSeen: number | null
  language: LanguageChoice
  isOperator: boolean
  version: string
  newVersion: boolean
}

interface Signed {
  id: string
  email: string
  image?: string | null
  ownPicture?: string | null
  username?: string | null
  usernameConfirmedAt?: Date | null
  tourSeen?: number | null
  language?: string | null
  versionSeen?: string | null
}

// The language the server writes to someone in when they aren't there to
// ask (#328): the Email Digest, Push Notifications. Their choice under
// Sprache; for "auto", the language last seen from their browser
// (recordBrowserLanguage), else English.
export function recipientLanguage({ language, browserLanguage }: { language: string | null, browserLanguage: string | null }): Language {
  return chooseLanguage(language, browserLanguage ? [browserLanguage] : [])
}

// The signed-in user as others see them on what they just added: the same
// name and picture as usernameOf and pictureOf select. Adding takes a
// Username (server/middleware/auth.ts), so there always is one.
export function shownAs({ id, image, ownPicture, username }: Omit<Signed, 'email' | 'usernameConfirmedAt' | 'tourSeen' | 'language' | 'versionSeen'>): { id: string, name: string, image: string | null } {
  return { id, name: username ?? '', image: ownPicture ?? image ?? null }
}

// /api/me's answer for the signed-in user, from their session.
export function meOf(signedIn: Signed): Me {
  const { id, email, image, ownPicture, username, usernameConfirmedAt, tourSeen, language, versionSeen } = signedIn
  return {
    id,
    name: username ?? '',
    email,
    image: ownPicture ?? image ?? null,
    ownPicture: ownPicture ?? null,
    usernamePrompt: !username ? 'pick' : usernameConfirmedAt ? null : 'confirm',
    tourSeen: tourSeen ?? null,
    language: languageChoice(language),
    isOperator: isOperator(email),
    version: APP_VERSION,
    newVersion: newerVersion(APP_VERSION, versionSeen ?? null),
  }
}

const meColumns = { id: user.id, email: user.email, image: user.image, ownPicture: user.ownPicture, username: user.username, usernameConfirmedAt: user.usernameConfirmedAt, tourSeen: user.tourSeen, language: user.language, versionSeen: user.versionSeen }

// Sets (or, with null, removes) the user's own Profile Picture.
export async function setOwnPicture(userId: string, url: string | null): Promise<Me | null> {
  const [updated] = await db.update(user).set({ ownPicture: url }).where(eq(user.id, userId)).returning(meColumns)
  return updated ? meOf(updated) : null
}

// Records that the user finished or skipped Tour `version`: only ever raises
// the one kept (greatest() passes over a null), so an older app's Tour can't
// bring a newer one back.
export async function recordTourSeen(userId: string, version: number): Promise<Me | null> {
  const [updated] = await db.update(user).set({ tourSeen: sql`greatest(${user.tourSeen}, ${version})` }).where(eq(user.id, userId)).returning(meColumns)
  return updated ? meOf(updated) : null
}

// Records that the user opened the Changelog in the app's Version.
export async function recordVersionSeen(userId: string): Promise<Me | null> {
  const [updated] = await db.update(user).set({ versionSeen: APP_VERSION || null }).where(eq(user.id, userId)).returning(meColumns)
  return updated ? meOf(updated) : null
}

// Remembers the language the user's browser asked for last (shared/language.ts
// chooseLanguage of its Accept-Language), for when they aren't there to ask.
export async function recordBrowserLanguage(userId: string, language: Language): Promise<void> {
  await db.update(user).set({ browserLanguage: language }).where(eq(user.id, userId))
}

// Sets the user's language under Sprache in Your Settings.
export async function setLanguage(userId: string, language: LanguageChoice): Promise<Me | null> {
  const [updated] = await db.update(user).set({ language }).where(eq(user.id, userId)).returning(meColumns)
  return updated ? meOf(updated) : null
}

// As the unique index compares them (server/db/schema.ts).
const sameUsername = (username: string) => sql`lower(${user.username} collate "und-x-icu") = lower(${username} collate "und-x-icu")`

// Whether someone else has the Username, whatever the case.
export async function usernameTaken(userId: string, username: string): Promise<boolean> {
  const [other] = await db.select({ id: user.id }).from(user).where(and(sameUsername(username), ne(user.id, userId))).limit(1)
  return !!other
}

// Makes `username` the user's Username, and theirs for good: they aren't
// asked about it again. 'taken' if someone else got it first (the unique
// index decides, not usernameTaken's look before).
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
