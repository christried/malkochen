import 'dotenv/config'
import pg from 'pg'
import { expect, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Column Subtitles (CONTEXT.md): the short line under a Column's name. Lise
// is used by this file only; each test works on a Board of its own.

interface Column {
  id: string
  name: string
  subtitle: string | null
  isGekocht: boolean
}
interface Board {
  id: string
  columns: Column[]
}

function send(caller: Caller, method: string, path: string, body?: unknown) {
  return caller.fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function newBoard(caller: Caller): Promise<Board> {
  const res = await send(caller, 'POST', '/api/boards', { name: 'Untertitel', emoji: '🥕' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  return (await caller.fetch(`/api/boards/${id}`)).json() as Promise<Board>
}

const subtitles = (board: Board) => board.columns.map(({ name, subtitle }) => ({ name, subtitle }))

test('a new Board’s Columns come with their subtitles', async () => {
  const lise = await signIn(ALLOWLISTED[20])

  const board = await newBoard(lise)

  expect(subtitles(board)).toEqual([
    { name: 'Ideen', subtitle: 'Worauf hast du Lust?' },
    { name: 'Diese Woche', subtitle: 'Das steht an.' },
    { name: 'Gekocht', subtitle: 'Schon geschafft!' },
  ])
})

test('the migration gives existing Boards’ Columns their subtitles only where they keep their default names', async () => {
  const before = await migrationsBefore('0010_column_subtitle')
  const database = await createThrowawayDatabase(readAdminUrl(), before.folder)
  const client = new pg.Client({ connectionString: database.url })
  try {
    await client.connect()
    await client.query(`
      with untouched as (
        insert into board (name, emoji) values ('Unverändert', '🍲') returning id
      ), renamed as (
        insert into board (name, emoji) values ('Umbenannt', '🍜') returning id
      )
      insert into board_column (board_id, name, position, is_gekocht)
      select id, c.name, c.position, c.is_gekocht from untouched, (values
        ('Ideen', 0, false), ('Diese Woche', 1, false), ('Gekocht', 2, true)
      ) as c(name, position, is_gekocht)
      union all
      select id, c.name, c.position, c.is_gekocht from renamed, (values
        ('Ideensammlung', 0, false), ('Bald', 1, false), ('Wochenende', 2, false), ('Ideen', 3, true)
      ) as c(name, position, is_gekocht)
    `)

    await migrateDatabase(database.url)

    const { rows } = await client.query(`
      select board.name as board, board_column.name, subtitle from board_column join board on board.id = board_id
      where not is_gekocht order by board.name desc, position
    `)
    expect(rows).toEqual([
      { board: 'Unverändert', name: 'Ideen', subtitle: 'Worauf hast du Lust?' },
      { board: 'Unverändert', name: 'Diese Woche', subtitle: 'Das steht an.' },
      { board: 'Umbenannt', name: 'Ideensammlung', subtitle: null },
      { board: 'Umbenannt', name: 'Bald', subtitle: null },
      { board: 'Umbenannt', name: 'Wochenende', subtitle: null },
    ])
  }
  finally {
    await client.end()
    await database.drop()
    await before.remove()
  }
})
