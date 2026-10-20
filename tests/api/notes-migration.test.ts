import 'dotenv/config'
import pg from 'pg'
import { expect, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'

// Notes become Comments (#333): a Dish's note becomes a Comment by whoever
// added the Dish, at the Dish's creation time; a Cooking's note one by
// whoever recorded it, at its time. An author whose account is gone stays
// unknown ("Gelöschtes Konto"). An empty note becomes nothing, and so does
// the note of a deleted Cooking, which isn't in the Dish History either.

test('the migration turns Dish notes and Cooking notes into Comments', async () => {
  const before = await migrationsBefore('0029_notes_become_comments')
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
    const dish = async (title: string, note: string | null, addedBy: string | null, createdAt: string, archived = false) => (await client.query<{ id: string }>(
      `insert into dish (board_id, column_id, position, title, placeholder, note, added_by, created_at, deleted_at)
       values ($1, $2, 0, $3, 'bowl', $4, $5, $6, ${archived ? 'now()' : 'null'}) returning id`,
      [board!.id, column!.id, title, note, addedBy, createdAt],
    )).rows[0]!.id
    const cooking = (dishId: string, note: string | null, recordedBy: string | null, cookedAt: string, deleted = false) => client.query(
      `insert into cooking (dish_id, note, recorded_by, cooked_at, deleted_at) values ($1, $2, $3, $4, ${deleted ? 'now()' : 'null'})`,
      [dishId, note, recordedBy, cookedAt],
    )

    const curry = await dish('Curry', 'mit extra Knoblauch', 'ada', '2026-09-01T10:00:00Z')
    const byGoneAccount = await dish('Dal', 'Linsen vorher anrösten', null, '2026-09-02T10:00:00Z')
    const archived = await dish('Archiviert', 'reicht für vier', 'linus', '2026-09-03T10:00:00Z', true)
    const withoutNote = await dish('Ohne Notiz', null, 'ada', '2026-09-04T10:00:00Z')
    await dish('Leere Notiz', '  ', 'ada', '2026-09-05T10:00:00Z')
    await cooking(curry, 'nächstes Mal schärfer', 'linus', '2026-09-10T18:00:00Z')
    await cooking(curry, null, 'ada', '2026-09-11T18:00:00Z')
    await cooking(curry, '', 'ada', '2026-09-12T18:00:00Z')
    await cooking(withoutNote, 'perfekt so', null, '2026-09-13T18:00:00Z')
    await cooking(withoutNote, 'gelöscht', 'ada', '2026-09-14T18:00:00Z', true)

    await migrateDatabase(database.url)

    const { rows } = await client.query<{ dish_id: string, author_id: string | null, text: string, created_at: Date, edited_at: Date | null, deleted_at: Date | null }>(
      'select dish_id, author_id, text, created_at, edited_at, deleted_at from comment order by created_at',
    )
    const comment = (dishId: string, authorId: string | null, text: string, at: string) =>
      ({ dish_id: dishId, author_id: authorId, text, created_at: new Date(at), edited_at: null, deleted_at: null })
    expect(rows).toEqual([
      comment(curry, 'ada', 'mit extra Knoblauch', '2026-09-01T10:00:00Z'),
      comment(byGoneAccount, null, 'Linsen vorher anrösten', '2026-09-02T10:00:00Z'),
      comment(archived, 'linus', 'reicht für vier', '2026-09-03T10:00:00Z'),
      comment(curry, 'linus', 'nächstes Mal schärfer', '2026-09-10T18:00:00Z'),
      comment(withoutNote, null, 'perfekt so', '2026-09-13T18:00:00Z'),
    ])

    // The notes themselves are gone.
    const { rows: noteColumns } = await client.query(
      `select table_name from information_schema.columns where table_name in ('dish', 'cooking') and column_name = 'note'`,
    )
    expect(noteColumns).toEqual([])
  }
  finally {
    await client.end()
    await database.drop()
    await before.remove()
  }
})
