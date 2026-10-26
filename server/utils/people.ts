import { and, eq, ne, sql } from 'drizzle-orm'
import { stringsFor } from '../../app/strings'
import { newerVersion } from '../../shared/changelog'
import { chooseLanguage, languageChoice, type Language, type LanguageChoice } from '../../shared/language'
import type { UsernamePrompt } from '../../shared/username'
import { db } from '../db'
import { APP_VERSION } from '../version'
import { user } from '../db/schema'
import { detailsOf, recordEvents, withEvents, type PromptAnswer, type PromptKind } from './events'
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
// Version and whether it is newer than the last one
// they opened the Changelog in (#354).
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
  // The last Version they opened the Changelog in or closed its popup on;
  // null for none. The Changelog Popup lists the Versions after it (#406).
  versionSeen: string | null
  // When they signed up, and when each Notification Prompt was last shown
  // to them (ISO; null for never): the Board decides which one is due (#407).
  signedUpAt: string
  pushPromptedAt: string | null
  digestPromptedAt: string | null
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
  // Dates, or ISO strings if a cached session carries them as text.
  createdAt: Date | string
  pushPromptedAt?: Date | string | null
  digestPromptedAt?: Date | string | null
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
export function shownAs({ id, image, ownPicture, username }: Omit<Signed, 'email' | 'usernameConfirmedAt' | 'tourSeen' | 'language' | 'versionSeen' | 'createdAt' | 'pushPromptedAt' | 'digestPromptedAt'>): { id: string, name: string, image: string | null } {
  return { id, name: username ?? '', image: ownPicture ?? image ?? null }
}

// /api/me's answer for the signed-in user, from their session.
export function meOf(signedIn: Signed): Me {
  const { id, email, image, ownPicture, username, usernameConfirmedAt, tourSeen, language, versionSeen, createdAt, pushPromptedAt, digestPromptedAt } = signedIn
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
    versionSeen: versionSeen ?? null,
    signedUpAt: new Date(createdAt).toISOString(),
    pushPromptedAt: pushPromptedAt ? new Date(pushPromptedAt).toISOString() : null,
    digestPromptedAt: digestPromptedAt ? new Date(digestPromptedAt).toISOString() : null,
  }
}

const meColumns = { id: user.id, email: user.email, image: user.image, ownPicture: user.ownPicture, username: user.username, usernameConfirmedAt: user.usernameConfirmedAt, tourSeen: user.tourSeen, language: user.language, versionSeen: user.versionSeen, createdAt: user.createdAt, pushPromptedAt: user.pushPromptedAt, digestPromptedAt: user.digestPromptedAt }

// Sets (or, with null, removes) the user's own Profile Picture. The event
// log records it only when the picture differs from before (#399).
export async function setOwnPicture(userId: string, url: string | null): Promise<Me | null> {
  await withEvents(
    db,
    db.update(user).set({ ownPicture: url }).where(eq(user.id, userId)).returning({ id: user.id, ownPicture: user.ownPicture }),
    { kind: 'picture_changed', board: sql`null`, user: userId, details: detailsOf({ on: url !== null }) },
    { earlier: sql`select id, own_picture from ${user} where id = ${userId}`, where: sql`earlier.own_picture is distinct from changed.own_picture` },
  )
  return meOfUser(userId)
}

// The signed-in user as their session has them now, for an answer after a write.
async function meOfUser(userId: string): Promise<Me | null> {
  const [found] = await db.select(meColumns).from(user).where(eq(user.id, userId))
  return found ? meOf(found) : null
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

// A Notification Prompt (CONTEXT.md, #407) was shown to the user: keeps the
// time, whatever the answer will be, and records prompt_shown (an event of
// no Board).
export async function recordPromptShown(userId: string, which: PromptKind): Promise<Me | null> {
  const column = which === 'push' ? { pushPromptedAt: sql`now()` } : { digestPromptedAt: sql`now()` }
  const rows = await withEvents(
    db,
    db.update(user).set(column).where(eq(user.id, userId)).returning({ id: user.id }),
    { kind: 'prompt_shown', board: sql`null`, user: userId, details: detailsOf({ which }) },
  )
  if (rows.rows.length === 0) return null
  return meOfUser(userId)
}

// How the user answered a Notification Prompt, recorded as prompt_answered.
export async function recordPromptAnswered(userId: string, which: PromptKind, answer: PromptAnswer): Promise<Me | null> {
  await recordEvents(
    db,
    { kind: 'prompt_answered', board: sql`null`, user: userId, details: detailsOf({ which, answer }) },
    sql`from ${user} changed where changed.id = ${userId}`,
  )
  return meOfUser(userId)
}

// Remembers the language the user's browser asked for last (shared/language.ts
// chooseLanguage of its Accept-Language), for when they aren't there to ask.
export async function recordBrowserLanguage(userId: string, language: Language): Promise<void> {
  await db.update(user).set({ browserLanguage: language }).where(eq(user.id, userId))
}

// Sets the user's language under Sprache in Your Settings. Recorded only when
// it differs from before (#399).
export async function setLanguage(userId: string, language: LanguageChoice): Promise<Me | null> {
  await withEvents(
    db,
    db.update(user).set({ language }).where(eq(user.id, userId)).returning({ id: user.id, language: user.language }),
    { kind: 'language_changed', board: sql`null`, user: userId, details: detailsOf({ language }) },
    { earlier: sql`select id, language from ${user} where id = ${userId}`, where: sql`earlier.language is distinct from changed.language` },
  )
  return meOfUser(userId)
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
    // recorded only when the name differs from the one they had (#399).
    await withEvents(
      db,
      db
        .update(user)
        .set({ username, usernameConfirmedAt: sql`coalesce(${user.usernameConfirmedAt}, now())` })
        .where(eq(user.id, userId))
        .returning({ id: user.id, username: user.username }),
      { kind: 'username_changed', board: sql`null`, user: userId },
      { earlier: sql`select id, username from ${user} where id = ${userId}`, where: sql`earlier.username is distinct from changed.username` },
    )
    return meOfUser(userId)
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
