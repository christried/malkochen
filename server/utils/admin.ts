import { sql, type SQL } from 'drizzle-orm'
import { DAYS, SOURCE_COLUMNS, WEEKS, type Active, type AdminFigures, type Period, type SignUps, type SourceColumn } from '../../shared/admin'
import { db } from '../db'
import { IMAGE_FOLDERS } from '../image-store'
import { storage } from './image-store'
import { openSignUpOn } from './open-sign-up'

// The free amounts of what malkochen counts itself (docs/research/free-tiers.md).
const FREE = {
  // Neon Free: Postgres storage. Vercel Blob on Hobby: storage.
  databaseBytes: 1_000_000_000,
  blobBytes: 1_000_000_000,
  // Resend Free.
  emailsMonth: 3_000,
  emailsToday: 100,
  // Vercel Hobby: function invocations.
  functionCalls: 1_000_000,
}

// Days and weeks are Berlin's, where malkochen is used.
const ZONE = sql.raw(`'Europe/Berlin'`)
const localNow = sql`(now() at time zone ${ZONE})`

const count = (where: SQL) => sql`count(e.id) filter (where ${where})::int`

// The last `n` days or weeks, newest first, each with what the event log
// holds for it: a move is one to another Column (no reorder, no "Rückgängig"),
// a Vote one given where there was none. An event's period is found by its
// time, so the index on `at` is used.
async function periods(unit: 'day' | 'week', n: number): Promise<Period[]> {
  const step = sql.raw(`interval '1 ${unit}'`)
  const unitName = sql.raw(`'${unit}'`)
  const bySource = SOURCE_COLUMNS.map(kind => sql`${count(sql`e.kind = 'dish_added' and ${kind === 'none'
    ? sql`e.details->>'source' is null`
    : sql`e.details->>'source' = ${kind}`}`)} as ${sql.identifier(kind)}`)
  const rows = await db.execute<Record<SourceColumn | 'start' | 'moves' | 'cookings' | 'comments' | 'votes' | 'archived', string | number>>(sql`
    with p as (
      select generate_series(date_trunc(${unitName}, ${localNow}) - ${sql.raw(String(n - 1))} * ${step}, date_trunc(${unitName}, ${localNow}), ${step}) as start
    )
    select to_char(p.start, 'YYYY-MM-DD') as start,
      ${sql.join(bySource, sql`, `)},
      ${count(sql`e.kind = 'dish_moved' and e.details->'undo' is null and e.details->>'from' <> e.details->>'to'`)} as moves,
      ${count(sql`e.kind = 'cooking_recorded'`)} as cookings,
      ${count(sql`e.kind = 'comment_written'`)} as comments,
      ${count(sql`e.kind = 'vote_set'`)} as votes,
      ${count(sql`e.kind = 'dish_archived'`)} as archived
    from p
    left join event_log e on e.at >= (p.start at time zone ${ZONE}) and e.at < ((p.start + ${step}) at time zone ${ZONE})
    group by p.start
    order by p.start desc
  `)
  return rows.rows.map(row => ({
    start: String(row.start),
    dishes: Object.fromEntries(SOURCE_COLUMNS.map(kind => [kind, Number(row[kind])])) as Period['dishes'],
    moves: Number(row.moves),
    cookings: Number(row.cookings),
    comments: Number(row.comments),
    votes: Number(row.votes),
    archived: Number(row.archived),
  }))
}

// Who did something on a Board, and on which Boards, today, in the last 7
// days and in the last 30 (events of no Board, like switching Open Sign-up,
// left out). A Deleted Account's events count for its Boards only. A Push
// Notification sent (push_sent, #399) is something malkochen did to its
// recipient, not something they did, so it is left out too.
async function active(): Promise<AdminFigures['active']> {
  const today = sql`date_trunc('day', ${localNow}) at time zone ${ZONE}`
  const [row] = (await db.execute<Record<string, number>>(sql`
    select
      count(distinct user_id) filter (where at >= ${today})::int as today_users,
      count(distinct board_id) filter (where at >= ${today})::int as today_boards,
      count(distinct user_id) filter (where at >= now() - interval '7 days')::int as week_users,
      count(distinct board_id) filter (where at >= now() - interval '7 days')::int as week_boards,
      count(distinct user_id)::int as month_users,
      count(distinct board_id)::int as month_boards
    from event_log where at >= now() - interval '30 days' and board_id is not null and kind <> 'push_sent'
  `)).rows
  const of = (prefix: string): Active => ({ users: Number(row?.[`${prefix}_users`] ?? 0), boards: Number(row?.[`${prefix}_boards`] ?? 0) })
  return { today: of('today'), week: of('week'), month: of('month') }
}

// New users per day, newest first: by Google if a Google sign-in created
// them (its account row comes with the user), else by email (Better Auth's
// email sign-in creates no account row; a Google one linked later does).
async function signUps(): Promise<SignUps[]> {
  const rows = await db.execute<{ start: string, google: number, email: number }>(sql`
    with p as (
      select generate_series(date_trunc('day', ${localNow}) - ${sql.raw(String(DAYS - 1))} * interval '1 day', date_trunc('day', ${localNow}), interval '1 day') as start
    ),
    u as (
      select u.created_at, exists (select 1 from account a where a.user_id = u.id and a.provider_id = 'google' and a.created_at < u.created_at + interval '1 minute') as google
      from "user" u
      where u.created_at >= (date_trunc('day', ${localNow}) - ${sql.raw(String(DAYS - 1))} * interval '1 day') at time zone ${ZONE}
    )
    select to_char(p.start, 'YYYY-MM-DD') as start,
      count(u.created_at) filter (where u.google)::int as google,
      count(u.created_at) filter (where not u.google)::int as email
    from p
    left join u on u.created_at >= (p.start at time zone ${ZONE}) and u.created_at < ((p.start + interval '1 day') at time zone ${ZONE})
    group by p.start
    order by p.start desc
  `)
  return rows.rows.map(row => ({ start: String(row.start), google: Number(row.google), email: Number(row.email) }))
}

// What is used of the free tiers, as far as malkochen counts it: the
// database's size, what the Image Store keeps (listing Blob takes an
// operation per thousand images), and usage_count's emails and polls.
async function limits(): Promise<AdminFigures['limits']> {
  const [[sizes], stored] = await Promise.all([
    db.execute<{ database: string, emails_month: string, emails_today: string, polls_month: string }>(sql`
      select pg_database_size(current_database())::text as database,
        coalesce(sum(count) filter (where kind = 'email'), 0)::text as emails_month,
        coalesce(sum(count) filter (where kind = 'email' and day = (now() at time zone 'utc')::date), 0)::text as emails_today,
        coalesce(sum(count) filter (where kind = 'poll'), 0)::text as polls_month
      from usage_count
      where day >= date_trunc('month', now() at time zone 'utc')::date
    `).then(result => result.rows),
    Promise.all(IMAGE_FOLDERS.map(folder => storage.list(folder))),
  ])
  return {
    database: { used: Number(sizes?.database ?? 0), free: FREE.databaseBytes },
    blob: { used: stored.flat().reduce((sum, image) => sum + image.bytes, 0), free: FREE.blobBytes },
    emailsMonth: { used: Number(sizes?.emails_month ?? 0), free: FREE.emailsMonth },
    emailsToday: { used: Number(sizes?.emails_today ?? 0), free: FREE.emailsToday },
    functionCalls: { used: Number(sizes?.polls_month ?? 0), free: FREE.functionCalls },
  }
}

export async function adminFigures(): Promise<AdminFigures> {
  const [days, weeks, activeNow, signUpDays, used, openSignUp] = await Promise.all([periods('day', DAYS), periods('week', WEEKS), active(), signUps(), limits(), openSignUpOn()])
  return { days, weeks, active: activeNow, signUps: signUpDays, limits: used, openSignUp }
}
