import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

// Drizzle schema; `pnpm db:generate` turns changes here into a migration under
// ./migrations. Every timestamp is `timestamptz`, so values never depend on the
// machine's time zone.
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date())

// ---------------------------------------------------------------------------
// Better Auth. The JS property names are what its Drizzle adapter queries, so
// they must match its own field names exactly -- tests/unit/auth-schema.test.ts
// compares them against better-auth's table definitions.

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
  createdAt: createdAt(),
})

export const membership = pgTable('membership', {
  boardId: uuid('board_id').notNull().references(() => board.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  isOwner: boolean('is_owner').notNull().default(false),
  // When this Member last opened the Board: picks the Board a returning user
  // lands on, and later marks New Dishes.
  lastOpenedAt: timestamp('last_opened_at', { withTimezone: true }),
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
