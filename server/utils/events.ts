import { and, sql, type SQL, type SQLWrapper } from 'drizzle-orm'
import type { EventKind } from '../../shared/event-kinds'
import type { LanguageChoice } from '../../shared/language'
import type { Permission } from '../../shared/permissions'
import type { PushOutcome } from '../push'
import type { SourceKind } from '../source-lookup'
import type { Db } from '../db'
import { dish, eventLog } from '../db/schema'

// The event log (#331; server/db/schema.ts): what happens on Boards, for the
// Operator's Admin Page to count. Each write records its events in the same
// transaction as its change, so there is an event exactly when the change
// went through. Never content: only ids, the kind and these details.

export type { EventKind }

// How a Member signed in: Google, the email code, or the dev bypass (local
// dev and tests). null when no sign-in endpoint says.
export type SignInMethod = 'google' | 'code' | 'dev'

// What an event says beyond its Board, Dish and user, by kind. `undo`: the
// write was a "Rückgängig", taking back the one before it.
export type EventDetails =
  // signed_up, signed_in: how they signed in.
  | { method: SignInMethod | null }
  // board_created: the Board a first landing creates (PRD story 3).
  | { starter: true }
  // dish_added: the kind of its Source, null without one; `tour` for the
  // Dish the Tour has the user add.
  | { source: SourceKind | null, tour?: true }
  // dish_moved: the Columns it went from and to, and the Board it came
  // from if that isn't the one it went to.
  | { from: string, to: string, fromBoard?: string, undo?: true }
  // cooking_recorded, cooking_deleted, cooking_restored.
  | { cooking: string, undo?: true }
  // comment_written, comment_edited, comment_deleted, comment_restored:
  // which Comment, never its text.
  | { comment: string }
  // vote_set, vote_changed: the thumb it is now; vote_taken_back: the one
  // it was.
  | { up: boolean }
  // member_removed: who the Owner removed.
  | { member: string }
  // open_sign_up_switched, picture_changed (set or removed), push_switched,
  // digest_switched: whether it is on now.
  | { on: boolean }
  // language_changed: the language chosen under Sprache (a setting).
  | { language: LanguageChoice }
  // push_sent: what the push service answered for the device.
  | { outcome: PushOutcome }
  // digest_sent: how many Boards it listed.
  | { boards: number }
  // dish_edited: which of its fields changed, never their values.
  | { fields: DishField[] }
  // column_added, column_renamed, column_reordered and column_deleted: which
  // Column (column_reordered: none, it is the Board's).
  | { column: string }
  // column_subtitle_changed: which Column, and whether it has a Subtitle now.
  | { column: string, on: boolean }
  // permission_changed: whose, which Permission, and whether it is on now.
  | { member: string, permission: Permission, on: boolean }
  // default_permission_changed: which Permission, and whether it is on now.
  | { permission: Permission, on: boolean }
  // ownership_handed_over: to whom.
  | { member: string }
  // dish_link_opened: whether the viewer was signed in. The event's user
  // is null when they weren't, but also once a deleted account is gone, so
  // only this tells the two apart.
  | { signedIn: boolean }

// The fields of a Dish an edit can change (dish_edited): the title, the
// image (or its Placeholder), the Source, the Creator and the Focus Point.
export type DishField = 'title' | 'image' | 'source' | 'creator' | 'focus'

// One event per row of the statement it is recorded with: its kind, and
// SQL for its Board, Dish and details over that row. `user` did it (null
// for none: a deleted account's own event).
export interface EventValues {
  kind: EventKind
  board: SQL
  dish?: SQL
  // Null for someone signed out (dish_link_opened).
  user: string | null
  details?: SQL
  // Only for the rows this holds for (over the write's `changed` row, and
  // its `earlier` one if given).
  when?: SQL
}

// Details known before the write, as SQL.
export function detailsOf(details: EventDetails): SQL {
  return sql`${JSON.stringify(details)}::jsonb`
}

function selectEvent({ kind, board, dish, user, details }: EventValues): SQL {
  return sql`select ${kind}::text, (${board})::uuid, (${dish ?? sql`null`})::uuid, ${user}::text, (${details ?? sql`null`})::jsonb`
}

const insertEvent = sql`insert into ${eventLog} (kind, board_id, dish_id, user_id, details)`

// Inserts the event for each row `from` ("from … where …") finds: within
// a statement that makes the change, as a step of it (a `with` query
// reading what an earlier one returned).
export function insertEvents(event: EventValues, from: SQL): SQL {
  return sql`${insertEvent} ${selectEvent(event)} ${from}`
}

// The same as a statement of its own: for runAtomic, after the change it
// records, which it then sees.
export function recordEvents(d: Db, event: EventValues, from: SQL) {
  return d.execute(insertEvents(event, from))
}

// `write` (an insert, update or delete returning the rows it changed, an
// `id` among them if `earlier` is given) with its event, or events, recorded
// for each of those rows, in one statement. The events read them as
// `changed`, and, when `earlier` selects them by `id`, as they were before
// as `earlier`: only the rows in both get one then, and only those `where`
// holds for (and each event's own `when`). With `once`, one event per
// statement, however many rows it changed. Answers the changed rows, every
// one. (`getSQL()`, as a query builder put in SQL as is would be wrapped in
// parentheses, which a `with` query that writes may not be.)
export function withEvents(
  d: Db,
  write: SQLWrapper,
  event: EventValues | EventValues[],
  { earlier, where, once = false }: { earlier?: SQL, where?: SQL, once?: boolean } = {},
) {
  const events = Array.isArray(event) ? event : [event]
  return d.execute<Record<string, unknown>>(sql`
    with ${earlier ? sql`earlier as (${earlier}), ` : sql``}changed as (${write.getSQL()}),
    ${sql.join(events.map((e, i) => sql`recorded${sql.raw(String(i))} as (${insertEvents(e, eventRows(e, { earlier, where, once }))})`), sql`, `)}
    select * from changed
  `)
}

// The rows an event is recorded for, as the `from` of its insert.
function eventRows(event: EventValues, { earlier, where, once }: { earlier?: SQL, where?: SQL, once: boolean }): SQL {
  const conditions = [where, event.when].filter((c): c is SQL => c !== undefined)
  return sql`from ${once ? sql`(select * from changed limit 1) changed` : sql`changed`}
    ${earlier ? sql`join earlier using (id)` : sql``}
    ${conditions.length > 0 ? sql`where ${and(...conditions)}` : sql``}`
}

// The event of a Board, or of a membership of it, a write changed
// (`changed`, its row, with its `board_id`).
export function boardEvent(kind: EventKind, user: string, details?: SQL): EventValues {
  return { kind, board: sql`changed.board_id`, user, details }
}

// The event of a Dish a write changed (`changed`, its row).
export function dishEvent(kind: EventKind, user: string, details?: SQL): EventValues {
  return { kind, board: sql`changed.board_id`, dish: sql`changed.id`, user, details }
}

// The event of a Cooking a write changed (`changed`, its row), on the
// Board its Dish is on.
export function cookingEvent(kind: EventKind, user: string, { undo = false } = {}): EventValues {
  return {
    kind,
    board: sql`(select ${dish.boardId} from ${dish} where ${dish.id} = changed.dish_id)`,
    dish: sql`changed.dish_id`,
    user,
    details: sql`jsonb_build_object('cooking', changed.id${undo ? sql`, 'undo', true` : sql``})`,
  }
}

// The event of a Comment a write changed (`changed`, its row), on the
// Board its Dish is on.
export function commentEvent(kind: EventKind, user: string): EventValues {
  return {
    kind,
    board: sql`(select ${dish.boardId} from ${dish} where ${dish.id} = changed.dish_id)`,
    dish: sql`changed.dish_id`,
    user,
    details: sql`jsonb_build_object('comment', changed.id)`,
  }
}

// The event of a Vote a write changed (`changed`, its row), on the Board
// its Dish is on.
export function voteEvent(kind: EventKind, user: string): EventValues {
  return {
    kind,
    board: sql`(select ${dish.boardId} from ${dish} where ${dish.id} = changed.dish_id)`,
    dish: sql`changed.dish_id`,
    user,
    details: sql`jsonb_build_object('up', changed.up)`,
  }
}

// The event of a Column a write changed (`changed`, its row, with its
// `board_id`), on the Board it is on.
export function columnEvent(kind: EventKind, user: string, details?: SQL): EventValues {
  return { kind, board: sql`changed.board_id`, user, details: details ?? sql`jsonb_build_object('column', changed.id)` }
}
