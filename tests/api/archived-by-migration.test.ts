import 'dotenv/config'
import pg from 'pg'
import { expect, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'

// Archived Dishes (#336): a Dish already archived when who archived it
// started being kept gets it from the event log (#331): whoever archived it
// last, if their account still exists. One archived before the log began,
// or by an account since gone, stays unknown; a Dish on its Board has none.

test('the migration takes who archived a Dish from the event log, where it can', async () => {
  const before = await migrationsBefore('0026_archived_dishes')
  const database = await createThrowawayDatabase(readAdminUrl(), before.folder)
  const client = new pg.Client({ connectionString: database.url })
  try {
    await client.connect()
    await client.query(`insert into "user" (id, name, email) values ('ada', 'Ada', 'ada@example.com'), ('linus', 'Linus', 'linus@example.com')`)
    const { rows: [board] } = await client.query<{ id: string }>(`insert into board (name, emoji) values ('Kochclub', '🍜') returning id`)
    const { rows: [column] } = await client.query<{ id: string }>(
      `insert into board_column (board_id, name, position) values ($1, 'Ideen', 0) returning id`,
      [board!.id],
    )
    const dish = async (title: string, archived: boolean) => (await client.query<{ id: string }>(
      `insert into dish (board_id, column_id, position, title, placeholder, deleted_at)
       values ($1, $2, 0, $3, 'bowl', ${archived ? 'now()' : 'null'}) returning id`,
      [board!.id, column!.id, title],
    )).rows[0]!.id
    const archivedTwice = await dish('Zweimal archiviert', true)
    const beforeTheLog = await dish('Vor dem Protokoll', true)
    const byGoneAccount = await dish('Von einem gelöschten Konto', true)
    const onTheBoard = await dish('Auf dem Board', false)
    const logged = (dishId: string, kind: string, userId: string) => client.query(
      'insert into event_log (kind, board_id, dish_id, user_id) values ($1, $2, $3, $4)',
      [kind, board!.id, dishId, userId],
    )
    await logged(archivedTwice, 'dish_archived', 'linus')
    await logged(archivedTwice, 'dish_restored', 'ada')
    await logged(archivedTwice, 'dish_archived', 'ada')
    await logged(byGoneAccount, 'dish_archived', 'grace')
    await logged(onTheBoard, 'dish_archived', 'linus')
    await logged(onTheBoard, 'dish_restored', 'linus')

    await migrateDatabase(database.url)

    const { rows } = await client.query<{ id: string, archived_by: string | null }>('select id, archived_by from dish')
    const archivedBy = Object.fromEntries(rows.map(r => [r.id, r.archived_by]))
    expect(archivedBy).toEqual({ [archivedTwice]: 'ada', [beforeTheLog]: null, [byGoneAccount]: null, [onTheBoard]: null })
  }
  finally {
    await client.end()
    await database.drop()
    await before.remove()
  }
})
