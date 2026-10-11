import pg from 'pg'
import { inject } from 'vitest'

// What no client can do, so the tests do it in the server's database: let
// time pass for one thing, or make many calls at once (a rate limit used
// up). Everything else goes over HTTP (global-setup.ts).

// Makes a Cooking `minutes` older, as if it had been recorded that long
// before.
export async function backdateCooking(cookingId: string, minutes: number): Promise<void> {
  await query(`update cooking set cooked_at = cooked_at - make_interval(mins => $2) where id = $1`, [cookingId, minutes])
}

// Makes a deleted Dish or Cooking `days` longer deleted, as if it had been
// deleted that long before.
export async function backdateDeletion(table: 'dish' | 'cooking', id: string, days: number): Promise<void> {
  await query(`update ${table} set deleted_at = deleted_at - make_interval(days => $2) where id = $1`, [id, days])
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
