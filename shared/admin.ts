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
