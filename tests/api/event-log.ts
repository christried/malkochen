import pg from 'pg'
import { inject } from 'vitest'

// The event log (#331) as the tests read it. No endpoint serves it yet (the
// Admin Page, #321, will count it), so the tests read it in the server's
// database, through here only: what a test checks is which events a write
// recorded, not how the table stores them.

export interface LoggedEvent {
  kind: string
  boardId: string
  dishId: string | null
  userId: string | null
  details: Record<string, unknown> | null
}

// Starts watching the log: `recorded()` answers every event recorded since,
// oldest first. The API test files run one at a time, and their tests one
// after the other, so these are the test's own.
export async function watchEvents(): Promise<{ recorded: () => Promise<LoggedEvent[]> }> {
  const [{ last } = { last: '0' }] = await query<{ last: string }>('select coalesce(max(id), 0)::text as last from event_log')
  return {
    recorded: () => query<LoggedEvent>(
      `select kind, board_id as "boardId", dish_id as "dishId", user_id as "userId", details
       from event_log where id > $1 order by id`,
      [last],
    ),
  }
}

// Every event recorded so far, each row as text: what must never be in the
// log (titles, Comments, names) must not be in that.
export async function everyEventAsText(): Promise<string> {
  const rows = await query<{ row: string }>('select e::text as row from event_log e order by id')
  return rows.map(r => r.row).join('\n')
}

async function query<Row>(text: string, values: unknown[] = []): Promise<Row[]> {
  const client = new pg.Client({ connectionString: inject('databaseUrl') })
  await client.connect()
  try {
    return (await client.query(text, values)).rows as Row[]
  }
  finally {
    await client.end()
  }
}
