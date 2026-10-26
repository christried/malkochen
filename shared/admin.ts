import type { EventKind, PromptAnswer, PromptKind } from './event-kinds'
import type { Permission } from './permissions'
import { SOURCE_KINDS } from '../server/source-lookup/types'

// The Admin Page (#348, CONTEXT.md): what GET /api/admin answers the
// Operator, and the page shows as plain tables. Counts only, never content:
// no titles, Comments, emails or Usernames.

// The kinds of Source a Dish can be added from, and `none` for a Dish added
// without a link.
export const SOURCE_COLUMNS = [...SOURCE_KINDS, 'none'] as const
export type SourceColumn = typeof SOURCE_COLUMNS[number]

// One day or week (Berlin time), from the event log.
export interface Period {
  // Its first day, YYYY-MM-DD.
  start: string
  // Dishes added, by the kind of their Source.
  dishes: Record<SourceColumn, number>
  moves: number
  cookings: number
  comments: number
  votes: number
  archived: number
}

// Distinct users and Boards that did something on a Board.
export interface Active {
  users: number
  boards: number
}

export interface SignUps {
  start: string
  google: number
  email: number
}

// How much of a free tier malkochen uses, as far as it can count it itself.
export interface Usage {
  used: number
  free: number
}

export interface AdminFigures {
  // Newest first: the last DAYS days, today included, and the last WEEKS weeks.
  days: Period[]
  weeks: Period[]
  // Today, the last 7 days and the last 30 days.
  active: { today: Active, week: Active, month: Active }
  // Users who signed up, per day, newest first, by how they first signed in.
  // A deleted account no longer counts.
  signUps: SignUps[]
  limits: {
    // Bytes.
    database: Usage
    blob: Usage
    // This month (UTC, as Resend counts) and today.
    emailsMonth: Usage
    emailsToday: Usage
    // Function calls this month, estimated from the polls of open Boards,
    // which are most of them.
    functionCalls: Usage
  }
  // Open Sign-up (#350): whether anyone may sign up, not only the Allowlist.
  openSignUp: boolean
}

export const DAYS = 14
export const WEEKS = 8

// One Board as the Admin Page lists it (#397): live and Archived Boards
// alike. Counts and the Owner's Username only, never content.
export interface AdminBoard {
  id: string
  slug: string
  emoji: string
  name: string
  // The Owner's Username; null for a Deleted Account's Board or none yet.
  owner: string | null
  members: number
  // Not deleted.
  dishes: number
  // The newest event of the Board in the event log, as an ISO time.
  lastActivity: string | null
  archived: boolean
}

// ---------------------------------------------------------------------------
// The Event Log (#400, ADR 0009): what GET /api/admin/events answers. The
// event log stores ids only; names, titles and Comment texts are read as they
// are now, when the Operator looks. What is gone is marked as gone, never
// shown as it was.

// The groups the Event Log's filter offers, each with the kinds in it. Every
// kind is in exactly one: EveryKindGrouped fails typecheck for a kind that is
// in none, and the client test for one that is in two.
export const EVENT_GROUPS = {
  dishes: ['dish_added', 'dish_edited', 'dish_moved', 'dish_archived', 'dish_restored', 'dish_deleted'],
  cookings: ['cooking_recorded', 'cooking_deleted', 'cooking_restored'],
  talk: ['comment_written', 'comment_edited', 'comment_deleted', 'comment_restored', 'vote_set', 'vote_changed', 'vote_taken_back'],
  columns: ['column_added', 'column_renamed', 'column_subtitle_changed', 'column_reordered', 'column_deleted'],
  board: [
    'board_created',
    'board_archived',
    'board_restored',
    'board_deleted',
    'board_renamed',
    'board_emoji_changed',
    'invite_link_reset',
    'member_joined',
    'member_left',
    'member_removed',
    'ownership_handed_over',
    'permission_changed',
    'default_permission_changed',
  ],
  account: ['signed_up', 'signed_in', 'username_changed', 'picture_changed', 'language_changed', 'account_deleted'],
  notifications: ['push_switched', 'digest_switched', 'push_sent', 'digest_sent', 'prompt_shown', 'prompt_answered'],
  links: ['dish_link_opened', 'dish_copied'],
  operator: ['open_sign_up_switched'],
} as const satisfies Record<string, readonly EventKind[]>

export type EventGroup = keyof typeof EVENT_GROUPS

// Type test: `never` unless every EventKind is in a group. A new kind that
// isn't grouped makes this fail typecheck.
type Ungrouped = Exclude<EventKind, typeof EVENT_GROUPS[EventGroup][number]>
export type EveryKindGrouped = [Ungrouped] extends [never] ? true : { ungrouped: Ungrouped }
export const everyKindGrouped: EveryKindGrouped = true

// A user as the Event Log names them: their Username now; `deleted` for a
// Deleted Account (the event's user is gone, or was never kept);
// `signed-out` for someone who opened a Dish Link without signing in.
export type NamedUser = { id: string, name: string } | 'deleted' | 'signed-out'

// A Board as it is now. `deleted`: gone for good. An Archived Board has
// `archived`.
export type NamedBoard = { id: string, slug: string, name: string, emoji: string, archived: boolean } | 'deleted'

// A Dish as it is now. `deleted`: purged. An Archived Dish has `archived`.
export type NamedDish = { id: string, code: string, title: string, archived: boolean } | 'deleted'

// A Column's name now, or `deleted`.
export type NamedColumn = { name: string } | 'deleted'

// What an event says beyond the above, as the event log keeps it with its
// ids taken out (they became the names above). Never content.
export interface AdminEventDetails {
  // Whether a setting is on now (switches, Column Subtitle, Permissions).
  on?: boolean
  permission?: Permission
  // The thumb of a Vote: up or down.
  up?: boolean
  // The fields a Dish edit changed.
  fields?: string[]
  // The kind of a new Dish's Source, null without one.
  source?: string | null
  // How someone signed in or up.
  method?: string | null
  // What the push service answered.
  outcome?: string
  language?: string
  // How many Boards an Email Digest listed.
  boards?: number
  // Whether a Dish Link's viewer was signed in.
  signedIn?: boolean
  // A Notification Prompt: which one, and the answer (prompt_answered).
  which?: PromptKind
  answer?: PromptAnswer
  // A "Rückgängig" took back the event before it.
  undo?: boolean
}

export interface AdminEvent {
  // In the order the events were recorded.
  id: number
  // ISO time.
  at: string
  kind: EventKind
  user: NamedUser
  // Null for an event of no Board (open_sign_up_switched).
  board: NamedBoard | null
  dish: NamedDish | null
  // The Comment the event is about: its text now, or `deleted`.
  comment: { text: string } | 'deleted' | null
  // The Member it is about (member_removed, permission_changed, ...).
  member: NamedUser | null
  // The Column it is about (column_*).
  column: NamedColumn | null
  // A moved Dish's Columns, and the Board it came from if another.
  from: NamedColumn | null
  to: NamedColumn | null
  fromBoard: NamedBoard | null
  // A Copy (dish_copied): the Dish it was copied from, and the Board it is on,
  // as they are now; 'deleted' once that Dish is gone for good. null for every
  // other kind. `from` is null for a Copy: its details name a Dish, not a Column.
  copiedFrom: { dish: Exclude<NamedDish, 'deleted'>, board: NamedBoard } | 'deleted' | null
  details: AdminEventDetails
}

// A page of the Event Log, newest first. `next` is the `before` of the page
// after it, null at the end.
export interface AdminEventPage {
  events: AdminEvent[]
  next: number | null
}

export const EVENTS_PER_PAGE = 50
