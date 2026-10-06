import 'dotenv/config'
import pg from 'pg'
import { expect, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { PLACEHOLDERS } from '../../shared/placeholders'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'

// 12 Placeholder Images (ADR 0004, issue #132): Dishes on the five removed
// keys move once to the closest one left; every other Dish keeps its own.

// The 16 keys of ADR 0002, and where each Dish on one ends up.
const MOVED: Record<string, string> = {
  pasta: 'pasta',
  ramen: 'ramen',
  curry: 'bowl',
  bowl: 'bowl',
  salad: 'bowl',
  burger: 'burger',
  tacos: 'tacos',
  pizza: 'bread',
  wok: 'wok',
  porridge: 'breakfast',
  bread: 'bread',
  cake: 'cake',
  dumplings: 'dumplings',
  eintopf: 'eintopf',
  wrap: 'tacos',
  smoothie: 'smoothie',
}

test('the migration moves every Dish off a removed Placeholder Image, deleted ones too', async () => {
  const before = await migrationsBefore('0015_twelve_placeholders')
  const database = await createThrowawayDatabase(readAdminUrl(), before.folder)
  const client = new pg.Client({ connectionString: database.url })
  try {
    await client.connect()
    await client.query(`insert into board (name, emoji, slug) values ('Platzhalter', '🍲', 'platzhalter')`)
    await client.query(`
      insert into board_column (board_id, name, position, is_gekocht)
      select id, 'Ideen', 0, false from board
    `)
    // Each old key twice: once on the Board, once deleted (it can still be
    // restored, with its image).
    await client.query(`
      insert into dish (board_id, column_id, position, title, placeholder, deleted_at)
      select board_id, board_column.id, i * 2 + n, key, key, case when n = 2 then now() end
      from board_column, unnest($1::text[]) with ordinality as keys(key, i), generate_series(1, 2) n
    `, [Object.keys(MOVED)])

    await migrateDatabase(database.url)

    const dishes = await client.query<{ title: string, placeholder: string }>('select title, placeholder from dish')
    expect(dishes.rows).toHaveLength(32)
    for (const { title, placeholder } of dishes.rows) expect(placeholder, title).toBe(MOVED[title])
    expect(dishes.rows.every(({ placeholder }) => (PLACEHOLDERS as readonly string[]).includes(placeholder))).toBe(true)
  }
  finally {
    await client.end()
    await database.drop()
    await before.remove()
  }
})
