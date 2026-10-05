import { sql } from 'drizzle-orm'
import type { Placeholder } from '../../shared/placeholders'
import type { SourceKind } from '../source-lookup'
import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

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

// ---------------------------------------------------------------------------
// Boards (CONTEXT.md: Board, Member, Owner, Column, Gekocht Column).

export const board = pgTable('board', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  emoji: text('emoji').notNull(),
  // The secret in the Board's Invite Link (/invite/<token>). It never
  // expires; the Owner resets it by setting it back to its default.
  inviteToken: text('invite_token').notNull().unique().default(sql`replace(gen_random_uuid()::text, '-', '')`),
  createdAt: createdAt(),
})

export const membership = pgTable('membership', {
  boardId: uuid('board_id').notNull().references(() => board.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  isOwner: boolean('is_owner').notNull().default(false),
  // When this Member last had the Board open (opened it, or its polling saw
  // it): picks the Board a returning user lands on.
  lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
  // When they last had it open before the current open (or joined it, if
  // this is their first): Dishes other Members added since are New Dishes.
  // It stays put while the Board is open, so Dishes added meanwhile are
  // New too, until the next open moves it on.
  newSince: timestamp('new_since', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ columns: [t.boardId, t.userId] }),
  index('membership_user_id_idx').on(t.userId),
  // Exactly one Owner per Board (at most one here; creation always sets one).
  uniqueIndex('membership_one_owner_idx').on(t.boardId).where(sql`${t.isOwner}`),
])

export const boardColumn = pgTable('board_column', {
  id: uuid('id').primaryKey().defaultRandom(),
  boardId: uuid('board_id').notNull().references(() => board.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
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
  // No cascade: a Column's Dishes must be moved before it can be deleted.
  columnId: uuid('column_id').notNull().references(() => boardColumn.id),
  // Order within the Column, smallest first. New Dishes take one less than the
  // Column's smallest, so they go on top without touching the others.
  position: integer('position').notNull(),
  title: text('title').notNull(),
  note: text('note'),
  // The Source: its canonical link and kind, both null for a Dish without one.
  sourceLink: text('source_link'),
  sourceKind: text('source_kind').$type<SourceKind>(),
  // The Creator (CONTEXT.md): who published the Source, as it names itself.
  // Null when it names none, or a Member cleared it.
  creator: text('creator'),
  // The image: a copy in the Image Store if there is one, else the
  // Placeholder (a key from shared/placeholders.ts). Never a third-party link.
  imageUrl: text('image_url'),
  placeholder: text('placeholder').$type<Placeholder>().notNull(),
  // Who added it; kept (as unknown) if their account is ever deleted.
  addedBy: text('added_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  // Set when a Member deletes the Dish. A deleted Dish keeps its Column and
  // position, so undo puts it back where it was; it is left out everywhere else.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => [
  index('dish_board_id_idx').on(t.boardId),
  index('dish_column_id_position_idx').on(t.columnId, t.position),
])

// ---------------------------------------------------------------------------
// Cooking (CONTEXT.md: Cooking, Cooked). A Dish's Cookings are its Cooking
// History; they stay when it moves out of the Gekocht Column.

export const cooking = pgTable('cooking', {
  id: uuid('id').primaryKey().defaultRandom(),
  dishId: uuid('dish_id').notNull().references(() => dish.id, { onDelete: 'cascade' }),
  cookedAt: timestamp('cooked_at', { withTimezone: true }).notNull().defaultNow(),
  note: text('note'),
  // Who recorded it; kept (as unknown) if their account is ever deleted.
  recordedBy: text('recorded_by').references(() => user.id, { onDelete: 'set null' }),
  // Set when a Member deletes it from the Cooking History, so "Rückgängig"
  // can bring it back; left out everywhere else. Undoing the move that
  // recorded it removes it for good instead.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, t => [index('cooking_dish_id_idx').on(t.dishId, t.cookedAt)])
