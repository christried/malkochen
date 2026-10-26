import { sql, type SQL } from 'drizzle-orm'
import { EVENTS_PER_PAGE, type AdminEvent, type AdminEventDetails, type AdminEventPage, type NamedBoard, type NamedColumn, type NamedDish, type NamedUser } from '../../shared/admin'
import type { EventKind } from '../../shared/event-kinds'
import { db } from '../db'

// The Event Log for the Admin Page (#400, ADR 0009). The event log keeps ids
// only; everything the Operator reads here (Usernames, Board names, Dish
// titles, Comment texts, Column names) is joined in as it is now, so a
// rename shows everywhere and what is gone shows as gone.

export interface EventFilter {
  // Part of a Username.
  user?: string
  board?: string
  kinds?: EventKind[]
  // YYYY-MM-DD, both ends included, UTC.
  from?: string
  to?: string
  // The id of the last event the Operator has seen.
  before?: number
}

// An id kept in the details, as a uuid: null if it isn't one, so a malformed
// one never fails the query.
const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
const detailId = (key: string) => sql`(case when e.details->>${key} ~ ${UUID} then (e.details->>${key})::uuid end)`

const escapeLike = (text: string) => text.replace(/[\\%_]/g, c => `\\${c}`)

// Their Username, else the name Google gave: the Operator's own account may
// have none.
const nameOf = (alias: string) => sql.raw(`coalesce(${alias}.username, ${alias}.name)`)

type Row = {
  id: string
  at: Date
  kind: EventKind
  details: Record<string, unknown> | null
  event_board_id: string | null
  event_dish_id: string | null
  event_user_id: string | null
  user_name: string | null
  board_id: string | null
  board_slug: string | null
  board_name: string | null
  board_emoji: string | null
  board_archived: boolean | null
  dish_id: string | null
  dish_code: string | null
  dish_title: string | null
  dish_archived: boolean | null
  comment_id: string | null
  comment_text: string | null
  comment_deleted: boolean | null
  member_id: string | null
  member_name: string | null
  column_name: string | null
  column_found: boolean
  from_name: string | null
  from_found: boolean
  to_name: string | null
  to_found: boolean
  from_board_id: string | null
  from_board_slug: string | null
  from_board_name: string | null
  from_board_emoji: string | null
  from_board_archived: boolean | null
  copy_dish_id: string | null
  copy_dish_code: string | null
  copy_dish_title: string | null
  copy_dish_archived: boolean | null
  copy_board_id: string | null
  copy_board_slug: string | null
  copy_board_name: string | null
  copy_board_emoji: string | null
  copy_board_archived: boolean | null
}

// A page of events, newest first: `EVENTS_PER_PAGE` of those with an id below
// `before`, and the `before` for the next page unless this is the last.
export async function adminEvents(filter: EventFilter): Promise<AdminEventPage> {
  const where: SQL[] = []
  if (filter.before !== undefined) where.push(sql`e.id < ${filter.before}`)
  if (filter.user?.trim()) where.push(sql`${nameOf('u')} ilike ${`%${escapeLike(filter.user.trim())}%`}`)
  if (filter.board) where.push(sql`e.board_id = ${filter.board}::uuid`)
  if (filter.kinds) where.push(filter.kinds.length > 0 ? sql`e.kind in (${sql.join(filter.kinds.map(k => sql`${k}`), sql`, `)})` : sql`false`)
  if (filter.from) where.push(sql`e.at >= ${`${filter.from}T00:00:00Z`}::timestamptz`)
  if (filter.to) where.push(sql`e.at < (${`${filter.to}T00:00:00Z`}::timestamptz + interval '1 day')`)

  const { rows } = await db.execute<Row>(sql`
    select e.id::text, e.at, e.kind, e.details,
      e.board_id as event_board_id, e.dish_id as event_dish_id, e.user_id as event_user_id,
      ${nameOf('u')} as user_name,
      b.id as board_id, b.slug as board_slug, b.name as board_name, b.emoji as board_emoji, b.deleted_at is not null as board_archived,
      d.id as dish_id, d.code as dish_code, d.title as dish_title, d.deleted_at is not null as dish_archived,
      c.id as comment_id, c.text as comment_text, c.deleted_at is not null as comment_deleted,
      m.id as member_id, ${nameOf('m')} as member_name,
      col.name as column_name, col.id is not null as column_found,
      cf.name as from_name, cf.id is not null as from_found,
      ct.name as to_name, ct.id is not null as to_found,
      fb.id as from_board_id, fb.slug as from_board_slug, fb.name as from_board_name, fb.emoji as from_board_emoji, fb.deleted_at is not null as from_board_archived,
      df.id as copy_dish_id, df.code as copy_dish_code, df.title as copy_dish_title, df.deleted_at is not null as copy_dish_archived,
      dfb.id as copy_board_id, dfb.slug as copy_board_slug, dfb.name as copy_board_name, dfb.emoji as copy_board_emoji, dfb.deleted_at is not null as copy_board_archived
    from event_log e
    left join "user" u on u.id = e.user_id
    left join board b on b.id = e.board_id
    left join dish d on d.id = e.dish_id
    left join comment c on c.id = ${detailId('comment')}
    left join "user" m on m.id = e.details->>'member'
    left join board_column col on col.id = ${detailId('column')}
    left join board_column cf on cf.id = ${detailId('from')} and e.kind <> 'dish_copied'
    left join board_column ct on ct.id = ${detailId('to')}
    left join board fb on fb.id = ${detailId('fromBoard')}
    left join dish df on df.id = ${detailId('from')} and e.kind = 'dish_copied'
    left join board dfb on dfb.id = df.board_id
    ${where.length > 0 ? sql`where ${sql.join(where, sql` and `)}` : sql``}
    order by e.id desc
    limit ${EVENTS_PER_PAGE + 1}
  `)

  const events = rows.slice(0, EVENTS_PER_PAGE).map(toEvent)
  return { events, next: rows.length > EVENTS_PER_PAGE ? events[events.length - 1]!.id : null }
}

function toEvent(row: Row): AdminEvent {
  const details = row.details ?? {}
  const has = (key: string) => typeof details[key] === 'string'
  return {
    id: Number(row.id),
    at: new Date(row.at).toISOString(),
    kind: row.kind,
    user: userOf(row),
    board: row.event_board_id === null ? null : boardOf(row.board_id, row.board_slug, row.board_name, row.board_emoji, row.board_archived),
    dish: row.event_dish_id === null ? null : dishOf(row),
    comment: !has('comment') ? null : row.comment_id === null || row.comment_deleted ? 'deleted' : { text: row.comment_text ?? '' },
    member: !has('member') ? null : row.member_id === null ? 'deleted' : { id: row.member_id, name: row.member_name ?? '' },
    column: !has('column') ? null : columnOf(row.column_found, row.column_name),
    from: !has('from') || row.kind === 'dish_copied' ? null : columnOf(row.from_found, row.from_name),
    to: !has('to') ? null : columnOf(row.to_found, row.to_name),
    fromBoard: !has('fromBoard') ? null : boardOf(row.from_board_id, row.from_board_slug, row.from_board_name, row.from_board_emoji, row.from_board_archived),
    copiedFrom: row.kind !== 'dish_copied' ? null : copiedFromOf(row),
    details: plainDetails(details),
  }
}

// Nobody was there for a Dish Link opened signed out; otherwise no user row
// means a Deleted Account.
function userOf(row: Row): NamedUser {
  if (row.kind === 'dish_link_opened' && row.details?.signedIn === false) return 'signed-out'
  if (row.event_user_id === null || row.user_name === null) return 'deleted'
  return { id: row.event_user_id, name: row.user_name }
}

function boardOf(id: string | null, slug: string | null, name: string | null, emoji: string | null, archived: boolean | null): NamedBoard {
  if (id === null) return 'deleted'
  return { id, slug: slug ?? id, name: name ?? '', emoji: emoji ?? '', archived: archived === true }
}

function dishOf(row: Row): NamedDish {
  if (row.dish_id === null) return 'deleted'
  return { id: row.dish_id, code: row.dish_code ?? '', title: row.dish_title ?? '', archived: row.dish_archived === true }
}

// The Dish a Copy was copied from, as it is now; `deleted` once its row is gone.
function copiedFromOf(row: Row): AdminEvent['copiedFrom'] {
  if (row.copy_dish_id === null) return 'deleted'
  return {
    dish: { id: row.copy_dish_id, code: row.copy_dish_code ?? '', title: row.copy_dish_title ?? '', archived: row.copy_dish_archived === true },
    board: boardOf(row.copy_board_id, row.copy_board_slug, row.copy_board_name, row.copy_board_emoji, row.copy_board_archived),
  }
}

const columnOf = (found: boolean, name: string | null): NamedColumn => found ? { name: name ?? '' } : 'deleted'

// The details as they are, with every key the joins above made a name of
// (and the ids of Cookings) left out.
const IDS = ['comment', 'member', 'column', 'from', 'to', 'fromBoard', 'cooking']
function plainDetails(details: Record<string, unknown>): AdminEventDetails {
  return Object.fromEntries(Object.entries(details).filter(([key]) => !IDS.includes(key))) as AdminEventDetails
}
