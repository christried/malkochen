import pg from 'pg'
import { inject } from 'vitest'

// What no client can do, so the tests do it in the server's database: let
// time pass for one thing, or make many calls at once (a rate limit used
// up). Everything else goes over HTTP (global-setup.ts).

// Makes a Cooking `minutes` older, as if it had been recorded that long
// before.
export async function backdateCooking(cookingId: string, minutes: number): Promise<void> {
  await query(`update cooking set cooked_at = cooked_at - make_interval(mins => $2), arrived_at = arrived_at - make_interval(mins => $2) where id = $1`, [cookingId, minutes])
}

// Makes a deleted Dish, Cooking, Comment or Board `days` longer deleted, as if it had been
// deleted that long before.
export async function backdateDeletion(table: 'dish' | 'cooking' | 'board' | 'comment', id: string, days: number): Promise<void> {
  await query(`update ${table} set deleted_at = deleted_at - make_interval(days => $2) where id = $1`, [id, days])
}

// Makes Snackbert's last answer about a user's email address `hours` older,
// as if it had been asked that long before: a day at most is remembered
// (server/utils/snackbert.ts).
export async function ageSnackbertCheck(email: string, hours: number): Promise<void> {
  await query(`update snackbert set checked_at = checked_at - make_interval(hours => $2) where user_id = (select id from "user" where email = $1)`, [email, hours])
}

// Uses up `calls` of a user's limit (server/rate-limits.ts) in a window that
// starts now, as if they had made that many calls just now.
export async function useUpLimit(email: string, limited: string, calls: number): Promise<void> {
  await query(
    `insert into rate_limit_use (user_id, limited, window_start, calls)
     select id, $2, now(), $3 from "user" where email = $1
     on conflict (user_id, limited) do update set window_start = now(), calls = $3`,
    [email, limited, calls],
  )
}

// Ends a user's current window of a limit, as if it had passed.
export async function endLimitWindow(email: string, limited: string): Promise<void> {
  await query(
    `update rate_limit_use set window_start = window_start - interval '2 days'
     where limited = $2 and user_id = (select id from "user" where email = $1)`,
    [email, limited],
  )
}

// Ends every user's current window of a limit: for test files that make
// more calls than one user may in a window, such as uploads in a day.
export async function endLimitWindows(limited: string): Promise<void> {
  await query(`update rate_limit_use set window_start = window_start - interval '2 days' where limited = $1`, [limited])
}

// The same two for a limit counted per IP address (CLIENT_RATE_LIMITS).
export async function useUpClientLimit(client: string, limited: string, calls: number): Promise<void> {
  await query(
    `insert into client_limit_use (client, limited, window_start, calls) values ($1, $2, now(), $3)
     on conflict (client, limited) do update set window_start = now(), calls = $3`,
    [client, limited, calls],
  )
}

export async function endClientLimitWindow(client: string, limited: string): Promise<void> {
  await query(`update client_limit_use set window_start = window_start - interval '2 days' where client = $1 and limited = $2`, [client, limited])
}

// Gives a Dish's Recipe the link it was found at, as the Recipe Finder does
// when it follows a link from the Caption (CONTEXT.md: Recipe Finder); no
// Member can set it.
export async function foundRecipeAt(dishId: string, link: string): Promise<void> {
  await query('update dish set recipe_link = $2 where id = $1', [dishId, link])
}

async function query(text: string, values: unknown[]): Promise<void> {
  const client = new pg.Client({ connectionString: inject('databaseUrl') })
  await client.connect()
  try {
    await client.query(text, values)
  }
  finally {
    await client.end()
  }
}

// Gives a user the Google account a Google sign-in creates with them, as if
// they had signed up with Google rather than the dev sign-in.
export async function linkGoogleAccount(email: string): Promise<void> {
  await query(
    `insert into account (id, account_id, provider_id, user_id)
     select gen_random_uuid()::text, gen_random_uuid()::text, 'google', id from "user" where email = $1`,
    [email],
  )
}

// Lets the sign-in code last sent to `email` expire, as if it had been sent
// long enough ago.
export async function expireSignInCode(email: string): Promise<void> {
  await query(`update verification set expires_at = now() - interval '1 minute' where identifier = $1`, [`sign-in-otp-${email}`])
}

// Makes `version` the last Version a user saw the Changelog in, as if they
// had opened it back then (an older app can't be run here).
export async function setVersionSeen(email: string, version: string): Promise<void> {
  await query(`update "user" set version_seen = $2 where email = $1`, [email, version])
}

// Moves the events of a Board `days` into the past, as if they had happened
// that long before: for the Admin Page's time range.
export async function backdateBoardEvents(boardId: string, days: number): Promise<void> {
  await query(`update event_log set at = at - make_interval(days => $2) where board_id = $1`, [boardId, days])
}

// Rows read from the server's database, for what no endpoint shows: the
// tests read them here only (#424's Snackbert Reports, what is never kept).
export async function databaseRows<Row = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<Row[]> {
  const client = new pg.Client({ connectionString: inject('databaseUrl') })
  await client.connect()
  try {
    return (await client.query(text, values)).rows as Row[]
  }
  finally {
    await client.end()
  }
}

// Makes the Recipe Finder's search of a Dish (#500) `minutes` older, as if it
// had been claimed that long before: a search that is still looking after a
// few minutes counts as over.
export async function backdateRecipeSearch(dishId: string, minutes: number): Promise<void> {
  await query(`update dish set recipe_search_at = recipe_search_at - make_interval(mins => $2) where id = $1`, [dishId, minutes])
}
