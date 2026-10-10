import pg from 'pg'
import { inject } from 'vitest'

// What no client can do, so the tests do it in the server's database: let
// time pass for one thing. Everything else goes over HTTP (global-setup.ts).

// Makes a Cooking `minutes` older, as if it had been recorded that long
// before.
export async function backdateCooking(cookingId: string, minutes: number): Promise<void> {
  const client = new pg.Client({ connectionString: inject('databaseUrl') })
  await client.connect()
  try {
    await client.query(`update cooking set cooked_at = cooked_at - make_interval(mins => $2) where id = $1`, [cookingId, minutes])
  }
  finally {
    await client.end()
  }
}
