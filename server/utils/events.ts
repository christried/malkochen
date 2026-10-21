import { sql, type SQL, type SQLWrapper } from 'drizzle-orm'
import type { SourceKind } from '../source-lookup'
import type { Db } from '../db'
import { dish, eventLog } from '../db/schema'

// The event log (#331; server/db/schema.ts): what happens on Boards, for the
// Operator's Admin Page to count. Each write records its events in the same
// transaction as its change, so there is an event exactly when the change
// went through. Never content: only ids, the kind and these details.

export type EventKind =
  | 'board_created'
  // "Board löschen" (CONTEXT.md: Archived Board).
  | 'board_archived'
  // An Archived Board its Owner brought back.
  | 'board_restored'
  // An Archived Board its Owner deleted for good (before #337: any Board
  // its Owner deleted, which was then gone at once).
  | 'board_deleted'
  | 'member_joined'
  | 'member_left'
  | 'member_removed'
  | 'dish_added'
  | 'dish_moved'
  // "Archivieren" (CONTEXT.md: Archived Dish).
  | 'dish_archived'
  // Brought back from the Archive, or by "Rückgängig" right after.
  | 'dish_restored'
  // An Archived Dish the Owner deleted for good.
  | 'dish_deleted'
  | 'cooking_recorded'
  | 'cooking_deleted'
  | 'cooking_restored'
  // A Comment (CONTEXT.md) written, its text changed by its author,
  // deleted by its author or the Owner, and brought back by "Rückgängig".
  | 'comment_written'
  | 'comment_edited'
  | 'comment_deleted'
  | 'comment_restored'
  // A Vote (CONTEXT.md) given where the Member had none, changed to the
  // other thumb, and taken back.
  | 'vote_set'
  | 'vote_changed'
  | 'vote_taken_back'

// What an event says beyond its Board, Dish and user, by kind. `undo`: the
// write was a "Rückgängig", taking back the one before it.
export type EventDetails =
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

// One event per row of the statement it is recorded with: its kind, and
// SQL for its Board, Dish and details over that row. `user` did it.
export interface EventValues {
  kind: EventKind
  board: SQL
  dish?: SQL
  user: string
  details?: SQL
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
// `id` among them if `earlier` is given) with its event recorded for each
// of those rows, in one statement. The event reads them as `changed`, and,
// when `earlier` selects them by `id`, as they were before as `earlier`:
// only the rows in both get one then, and only those `where` holds for.
// Answers the changed rows, every one. (`getSQL()`, as a query builder put
// in SQL as is would be wrapped in parentheses, which a `with` query that
// writes may not be.)
export function withEvents(d: Db, write: SQLWrapper, event: EventValues, { earlier, where }: { earlier?: SQL, where?: SQL } = {}) {
  return d.execute<Record<string, unknown>>(sql`
    with ${earlier ? sql`earlier as (${earlier}), ` : sql``}changed as (${write.getSQL()}),
    recorded as (
      ${insertEvents(event, sql`from changed
        ${earlier ? sql`join earlier using (id)` : sql``}
        ${where ? sql`where ${where}` : sql``}`)}
    )
    select * from changed
  `)
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
