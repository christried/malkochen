import { sql } from 'drizzle-orm'
import { ALL_PERMISSIONS, type Permissions } from '../../shared/permissions'
import type { Placeholder } from '../../shared/placeholders'
import type { SourceKind } from '../source-lookup'
import type { EventDetails, EventKind } from '../utils/events'
import type { UsageKind } from '../utils/usage'
import { bigint, boolean, check, date, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

// Drizzle schema; `pnpm db:generate` turns changes here into a migration under
// ./migrations. Every timestamp is `timestamptz`, so values never depend on the
// machine's time zone.
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())

// ---------------------------------------------------------------------------
// Better Auth. The JS property names are what its Drizzle adapter queries, so
// they must match its own field names exactly. Better Auth checks this itself on
// first use (SchemaMismatchError), which the API tests' sign-ins exercise.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  // The Google photo, as Better Auth wrote it on the first sign-in.
  image: text('image'),
  // The user's own Profile Picture (CONTEXT.md), uploaded in their settings. Kept
  // apart from the Google photo, and Better Auth only reads it (an additional
  // field it never takes as input), so signing in with Google again never
  // overwrites it. Shown before the Google photo (server/utils/people.ts).
  ownPicture: text('own_picture'),
  // Their Username (CONTEXT.md): the only name the app shows of them,
  // `name` (from Google) never. Null until a new user has picked one. Only
  // PUT /api/me/username sets it; Better Auth just reads it, like ownPicture.
  username: text('username'),
  // When they picked it, or kept the one migration 0019 made from their
  // Google first name. Null with a Username: they are still to be asked
  // once whether it fits.
  usernameConfirmedAt: timestamp('username_confirmed_at', { withTimezone: true }),
  // The highest Tour version (CONTEXT.md → Tour) they finished or skipped;
  // null for none. Below the app's current one, the Tour starts by itself.
  // Only PUT /api/me/tour raises it; Better Auth just reads it.
  tourSeen: integer('tour_seen'),
  // Their language under Sprache in Your Settings (shared/language.ts):
  // "auto" (follow the browser) or a language. Only PUT /api/me/language
  // sets it; Better Auth just reads it.
  language: text('language').notNull().default('auto'),
  // The language their browser asked for last (#328), as malkochen speaks it
  // (de, en or it); null until one asked. What "auto" means when they aren't
  // there to ask: the Email Digest, Push Notifications. Only the API's guard
  // (server/middleware/auth.ts) sets it; Better Auth just reads it.
  browserLanguage: text('browser_language'),
  // The last Version (CONTEXT.md) they opened the Changelog in; null for
  // none. Older than the app's, Your Settings marks "Was ist neu" as new.
  // Only PUT /api/me/version-seen sets it; Better Auth just reads it.
  versionSeen: text('version_seen'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [
  // No two users share a Username, whatever the case. By Unicode's rules
  // ("und-x-icu"), not the database's locale: under a C locale lower()
  // leaves "Ä" as it is.
  uniqueIndex('user_username_lower_idx').on(sql`lower(${t.username} collate "und-x-icu")`),
])

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, t => [index('session_user_id_idx').on(t.userId)])

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [index('account_user_id_idx').on(t.userId)])

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, t => [index('verification_identifier_idx').on(t.identifier)])

// Better Auth's rate limit counts, per IP address and path. In the database,
// not each server instance's memory, so the limit holds across instances.
export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  // Milliseconds since the epoch, as Better Auth keeps it.
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
})

// A device a user turned push notifications on for (#219): the browser's
// push subscription, as PushSubscription.toJSON() hands it over. The endpoint
// is the device's own address at its push service, so it is the key: a
// device signed in to by someone else is theirs from then on. Deleted when
// turned off, or when the push service says the subscription is gone.
export const pushSubscription = pgTable('push_subscription', {
  endpoint: text('endpoint').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // The device's public key and auth secret, base64url: what the push is
  // encrypted for.
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: createdAt(),
}, t => [index('push_subscription_user_id_idx').on(t.userId)])

// A user who switched the Email Digest on (#220), for all their Boards; off,
// they have no row. coveredUntil: how far the digests have covered, so each
// Dish is listed once. Switching it on starts there, and each daily run
// moves it on (server/utils/email-digest.ts). Always whole milliseconds, so
// it reads back into a JS Date unchanged.
export const emailDigest = pgTable('email_digest', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  coveredUntil: timestamp('covered_until', { withTimezone: true }).notNull(),
})

// ---------------------------------------------------------------------------
// Boards (CONTEXT.md: Board, Member, Owner, Column, Gekocht Column).

export const board = pgTable('board', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull(),
  // The secret in the Board's Invite Link (/invite/<slug>-<secret>,
  // shared/invite.ts): 17 characters without look-alikes
  // (random_invite_secret(), migration 0014). A Board from before keeps its
  // 32 hex characters until the link is reset. It never expires; the Owner
  // resets it by setting it back to its default.
  inviteToken: text('invite_token').notNull().unique().default(sql`random_invite_secret()`),
  // Its Address (CONTEXT.md): /b/<slug>, made from its name and one of its
  // board_slug rows (server/utils/addresses.ts). Null only for a Board
  // created while the deployment before readable addresses still ran; its
  // address is its id then, until it is renamed.
  slug: text('slug'),
  createdAt: createdAt(),
  // Set when its Owner deletes it (CONTEXT.md: Archived Board): its
  // memberships move to archived_membership, so it is left out of
  // everything that goes by membership; the cleanup purges it after
  // RESTORABLE_FOR (server/utils/archived-boards.ts).
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // Its Board Version (ADR 0008): moves on with every change to what its
  // Members see on it, so an open Board asks only for this (GET
  // /api/boards/:id/version) and loads the whole Board when it moved.
  // Only the database's triggers move it (migration 0032), so no write
  // can forget to; per-Member reading state (seen_at, last opened, which
  // Dishes they opened) never does.
  version: bigint('version', { mode: 'number' }).notNull().default(0),
  // Its Default Permissions (CONTEXT.md): what a Member joining through
  // its Invite Link gets (server/utils/invites.ts). Everything allowed
  // until the Owner changes them.
  defaultPermissions: jsonb('default_permissions').$type<Permissions>().notNull().default(ALL_PERMISSIONS),
})

// Every slug a Board has had, its current one too: a former one forwards to
// the current one. Unique across all Boards, so no two Boards ever share an
// address, not even a former one.
export const boardSlug = pgTable('board_slug', {
  slug: text('slug').primaryKey(),
  boardId: uuid('board_id').notNull().references(() => board.id, { onDelete: 'cascade' }),
}, t => [index('board_slug_board_id_idx').on(t.boardId)])

// Lookups of a secret no Board has (an Invite Link) or no Dish has (a Dish
// Link), counted together, per client (its IP address),
// since the window started: too many, and the client gets no answer about
// any link for the rest of the window (server/utils/invites.ts).
export const inviteMiss = pgTable('invite_miss', {
  client: text('client').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
  misses: integer('misses').notNull().default(1),
})

// The costly calls a user made since their window started, per limit
// (server/rate-limits.ts): over the limit, they get 429 for the rest of
// the window (server/utils/rate-limit.ts).
export const rateLimitUse = pgTable('rate_limit_use', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  limited: text('limited').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
  calls: integer('calls').notNull().default(1),
}, t => [primaryKey({ columns: [t.userId, t.limited] })])

// The same per IP address, for what needs no session
// (CLIENT_RATE_LIMITS): over the limit, a call is dropped.
export const clientLimitUse = pgTable('client_limit_use', {
  client: text('client').notNull(),
  limited: text('limited').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
  calls: integer('calls').notNull().default(1),
}, t => [primaryKey({ columns: [t.client, t.limited] })])

export const membership = pgTable('membership', {
  boardId: uuid('board_id').notNull().references(() => board.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  isOwner: boolean('is_owner').notNull().default(false),
  // When this Member last opened the Board (or followed its Invite Link):
  // picks the Board a returning user lands on. Polling never moves it, so a
  // late poll of a Board just left can't put it back in front (#227).
  lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
  // When this Member last had the Board open (opened it, or its polling saw
  // it): the next open copies it into newSince.
  seenAt: timestamp('seen_at', { withTimezone: true }),
  // When they last had it open before the current open (or joined it, if
  // this is their first): Dishes other Members added since are New Dishes.
  // It stays put while the Board is open, so Dishes added meanwhile are
  // New too, until the next open moves it on.
  newSince: timestamp('new_since', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  // Their Permissions (shared/permissions.ts), every flag present. Read
  // through server/utils/permissions.ts, which lets the Owner do
  // everything whatever this holds. A Member joining through the Invite
  // Link gets the Board's Default Permissions; the Board's creator, and an
  // Owner handing over, everything.
  permissions: jsonb('permissions').$type<Permissions>().notNull().default(ALL_PERMISSIONS),
}, t => [
  primaryKey({ columns: [t.boardId, t.userId] }),
  index('membership_user_id_idx').on(t.userId),
  // Exactly one Owner per Board (at most one here; creation always sets one).
  uniqueIndex('membership_one_owner_idx').on(t.boardId).where(sql`${t.isOwner}`),
])

// The memberships of an Archived Board, as they were when it was archived,
// for restoring it with its Members. Kept apart from `membership`, so
// nothing that finds a user's Boards by membership finds an Archived Board.
export const archivedMembership = pgTable('archived_membership', {
  boardId: uuid('board_id').notNull().references(() => board.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  isOwner: boolean('is_owner').notNull(),
  lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
  seenAt: timestamp('seen_at', { withTimezone: true }),
  newSince: timestamp('new_since', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
  permissions: jsonb('permissions').$type<Permissions>().notNull().default(ALL_PERMISSIONS),
}, t => [
  primaryKey({ columns: [t.boardId, t.userId] }),
  index('archived_membership_user_id_idx').on(t.userId),
])

export const boardColumn = pgTable('board_column', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => board.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Its Column Subtitle (CONTEXT.md), if it has one. The Gekocht Column's is
  // fixed and never read from here (server/utils/columns.ts).
  subtitle: text('subtitle'),
  position: integer('position').notNull(),
  isGekocht: boolean('is_gekocht').notNull().default(false),
}, t => [
  index('board_column_board_id_idx').on(t.boardId),
  // Exactly one Gekocht Column per Board (at most one here; creation sets one).
  uniqueIndex('board_column_one_gekocht_idx').on(t.boardId).where(sql`${t.isGekocht}`),
])

// ---------------------------------------------------------------------------
// Dishes (CONTEXT.md: Dish, Source, Placeholder Image).

export const dish = pgTable('dish', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => board.id, { onDelete: 'cascade' }),
  // Its short code, the end of its Address (/b/<Board>/<title>-<code>):
  // four characters, unique across all Dishes, so it stays the same when the
  // Dish is renamed or moves to another Board. The database draws it
  // (random_dish_code(), migration 0013).
  code: text('code').notNull().unique().default(sql`random_dish_code()`),
  // No cascade: a Column's Dishes must be moved before it can be deleted.
  // Null only for an Archived Dish whose Column was deleted meanwhile: it
  // comes back at the top of the Column that takes new Dishes
  // (server/utils/dishes.ts), so it isn't moved along with the live ones.
  columnId: uuid('column_id').references(() => boardColumn.id),
  // Order within the Column, smallest first. New Dishes take one less than the
  // Column's smallest, so they go on top without touching the others.
  position: integer('position').notNull(),
  title: text('title').notNull(),
  // The Source: its canonical link and kind, both null for a Dish without one.
  sourceLink: text('source_link'),
  sourceKind: text('source_kind').$type<SourceKind>(),
  // The Creator (CONTEXT.md): who published the Source, as it names itself.
  // Null when it names none, or a Member cleared it.
  creator: text('creator'),
  // The Caption (CONTEXT.md): the text the Source shows with its post, read
  // when the Dish is added or its Source changes; never edited by a Member.
  // Null when the Source shows none, or there is no Source.
  caption: text('caption'),
  // Whether the Source has a video malkochen's player plays in place (#394),
  // read when the Dish is added or its Source changes: a TikTok video, a
  // YouTube Short, an Instagram post whose embed plays it. False for anything
  // else. Null when not known yet (every Dish from before #394 until #395
  // fills it in), or there is no Source.
  playableVideo: boolean('playable_video'),
  // The image: a copy in the Image Store if there is one, else the
  // Placeholder (a key from shared/placeholders.ts). Never a third-party link.
  imageUrl: text('image_url'),
  placeholder: text('placeholder').$type<Placeholder>().notNull(),
  // The image's focus point (shared/image-focus.ts), in whole percent of its
  // width and height: the part every frame that crops it shows. The centre
  // unless a Member shifted it; a Placeholder Image doesn't use it.
  imageFocusX: smallint('image_focus_x').notNull().default(50),
  imageFocusY: smallint('image_focus_y').notNull().default(50),
  // The Dish Link's secret (CONTEXT.md: Dish Link), made the first time a
  // Member shares the Dish (random_invite_secret(), migration 0014: the same
  // alphabet and length as an Invite Link's), kept through archive and
  // restore, gone with the Dish.
  linkSecret: text('link_secret').unique(),
  // Who added it; kept (as unknown) if their account is ever deleted.
  addedBy: text('added_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  // Set when a Member archives the Dish (CONTEXT.md: Archived Dish). It
  // keeps its Column and position, so restoring puts it back where it was;
  // it is left out everywhere but the Board's Archive.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  // Who archived it, while it is archived; null once their account is gone,
  // and for a Dish archived before this was kept and not in the event log.
  archivedBy: text('archived_by').references(() => user.id, { onDelete: 'set null' }),
}, t => [
  index('dish_board_id_idx').on(t.boardId),
  index('dish_column_id_position_idx').on(t.columnId, t.position),
  // Every Dish on its Board has a Column.
  check('dish_column_unless_archived', sql`${t.deletedAt} is not null or ${t.columnId} is not null`),
])

// ---------------------------------------------------------------------------
// Cooking (CONTEXT.md: Cooking, Cooked). A Dish's Cookings are its Cooking
// History; they stay when it moves out of the Gekocht Column.

export const cooking = pgTable('cooking', {
  id: uuid('id').primaryKey().defaultRandom(),
  dishId: uuid('dish_id').notNull().references(() => dish.id, { onDelete: 'cascade' }),
  cookedAt: timestamp('cooked_at', { withTimezone: true }).notNull().defaultNow(),
  // Who recorded it; kept (as unknown) if their account is ever deleted.
  recordedBy: text('recorded_by').references(() => user.id, { onDelete: 'set null' }),
  // Set when a Member deletes it from the Cooking History, so "Rückgängig"
  // can bring it back; left out everywhere else. Undoing the move that
  // recorded it removes it for good instead.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => [index('cooking_dish_id_idx').on(t.dishId, t.cookedAt)])

// ---------------------------------------------------------------------------
// Comments (CONTEXT.md: Comment): a Member's message on a Dish, in its Dish
// History (server/utils/comments.ts).

export const comment = pgTable('comment', {
  id: uuid('id').primaryKey().defaultRandom(),
  dishId: uuid('dish_id').notNull().references(() => dish.id, { onDelete: 'cascade' }),
  // Who wrote it; kept (as "Gelöschtes Konto") if their account is deleted.
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  // Trimmed, never empty, at most COMMENT_MAX characters (app/utils/comment-text.ts).
  text: text('text').notNull(),
  createdAt: createdAt(),
  // When its author last changed its text ("bearbeitet"); null if never.
  editedAt: timestamp('edited_at', { withTimezone: true }),
  // Set when its author or the Board's Owner deletes it, so "Rückgängig"
  // can bring it back; left out everywhere else, and purged by the daily
  // cleanup after RESTORABLE_FOR.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => [index('comment_dish_id_idx').on(t.dishId, t.createdAt)])

// ---------------------------------------------------------------------------
// Votes (CONTEXT.md: Vote): a Member's thumbs up or down on a Cooked Dish,
// one per Dish and Member (server/utils/votes.ts). Taking it back removes
// the row.

export const vote = pgTable('vote', {
  id: uuid('id').primaryKey().defaultRandom(),
  dishId: uuid('dish_id').notNull().references(() => dish.id, { onDelete: 'cascade' }),
  // Who gave it; kept (as "Gelöschtes Konto") if their account is deleted,
  // so a Dish can have several Votes by nobody.
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  // Thumbs up; false is thumbs down.
  up: boolean('up').notNull(),
  // When it was last set: the Dish History shows it then.
  votedAt: timestamp('voted_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  // One per Dish and Member; nulls are distinct, so not for Votes by nobody.
  uniqueIndex('vote_dish_id_user_id_idx').on(t.dishId, t.userId),
])

// ---------------------------------------------------------------------------
// When each Member last opened each Dish's detail (#335): what other
// Members added to its Dish History since marks its card for them
// (server/utils/dish-opened.ts). A Member without a row for a Dish counts
// from when they joined its Board.

export const dishOpened = pgTable('dish_opened', {
  dishId: uuid('dish_id').notNull().references(() => dish.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.dishId, t.userId] })])

// ---------------------------------------------------------------------------
// The event log (#331): what happens on Boards, one row per event, for the
// Operator's Admin Page to count. Written in the same transaction as the
// change it records (server/utils/events.ts), only appended to, and kept
// indefinitely, so it holds no content: never a title, Comment, name or link,
// only when, which kind, the ids involved and a few non-textual details.
// No foreign keys, so an event outlives the Board, Dish or account it names.

export const eventLog = pgTable('event_log', {
  // In the order the events were recorded.
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  kind: text('kind').$type<EventKind>().notNull(),
  // None for an event of malkochen as a whole (open_sign_up_switched).
  boardId: uuid('board_id'),
  dishId: uuid('dish_id'),
  // Who did it.
  userId: text('user_id'),
  details: jsonb('details').$type<EventDetails>(),
}, t => [index('event_log_at_idx').on(t.at)])

// ---------------------------------------------------------------------------
// Usage the Admin Page (#348) compares with the free tiers, that no other
// table holds: per UTC day (as Resend and Vercel count), the emails Resend
// took, and the polls of open Boards, counted one in POLL_SAMPLE
// (server/utils/usage.ts).

export const usageCount = pgTable('usage_count', {
  day: date('day').notNull(),
  kind: text('kind').$type<UsageKind>().notNull(),
  count: integer('count').notNull(),
}, t => [primaryKey({ columns: [t.day, t.kind] })])

// ---------------------------------------------------------------------------
// malkochen's own settings, which the Operator changes on the Admin Page
// without a redeploy: one row. `openSignUp`: Open Sign-up (CONTEXT.md, #350),
// off until the Operator switches it on. `sourceFactsFilledAt`: when the
// backfill of Captions and playable videos for Dishes added before #393 and
// #394 finished (server/utils/source-facts-fill.ts); null until then.

export const setting = pgTable('setting', {
  id: boolean('id').primaryKey().default(true),
  openSignUp: boolean('open_sign_up').notNull().default(false),
  sourceFactsFilledAt: timestamp('source_facts_filled_at', { withTimezone: true }),
}, t => [check('setting_one_row', sql`${t.id}`)])
