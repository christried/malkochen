import 'dotenv/config'
import pg from 'pg'
import { expect, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Column Subtitles (CONTEXT.md): the short line under a Column's name. The
// Gekocht Column's is fixed and shown by the app, so the API answers null
// for it (#328). Lise
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

const boardOf = async (caller: Caller, id: string) => (await caller.fetch(`/api/boards/${id}`)).json() as Promise<Board>

async function newBoard(caller: Caller): Promise<Board> {
  const res = await send(caller, 'POST', '/api/boards', { name: 'Untertitel', emoji: '🥕' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  return boardOf(caller, id)
}

const subtitles = (board: Board) => board.columns.map(({ name, subtitle }) => ({ name, subtitle }))

test('a new Board’s Columns come with their subtitles', async () => {
  const lise = await signIn(ALLOWLISTED[20])

  const board = await newBoard(lise)

  expect(subtitles(board)).toEqual([
    { name: 'Ideen', subtitle: 'Worauf hast du Lust?' },
    { name: 'Diese Woche', subtitle: 'Das steht an.' },
    // Fixed, so not stored: the app shows it in each viewer's language.
    { name: 'Gekocht', subtitle: null },
  ])
})

test('a renamed Column keeps its subtitle, and the Gekocht Column still has none of its own', async () => {
  const lise = await signIn(ALLOWLISTED[20])
  const board = await newBoard(lise)
  const [ideen, , gekocht] = board.columns

  for (const [column, name] of [[ideen!, 'Ideensammlung'], [gekocht!, 'Erledigt']] as const) {
    const res = await send(lise, 'PATCH', `/api/columns/${column.id}`, { name })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ name, subtitle: column.subtitle })
  }

  expect(subtitles(await boardOf(lise, board.id))).toEqual([
    { name: 'Ideensammlung', subtitle: 'Worauf hast du Lust?' },
    { name: 'Diese Woche', subtitle: 'Das steht an.' },
    { name: 'Erledigt', subtitle: null },
  ])
})

test('a new Column starts without a subtitle; a Member sets one and clears it again', async () => {
  const lise = await signIn(ALLOWLISTED[20])
  const board = await newBoard(lise)
  const added = await (await send(lise, 'POST', `/api/boards/${board.id}/columns`, { name: 'Wochenende' })).json() as Column
  expect(added.subtitle).toBeNull()

  const set = await send(lise, 'PATCH', `/api/columns/${added.id}`, { subtitle: '  Wenn Zeit ist. ' })
  expect(set.status).toBe(200)
  expect(await set.json()).toMatchObject({ name: 'Wochenende', subtitle: 'Wenn Zeit ist.' })
  expect((await boardOf(lise, board.id)).columns.at(-1)).toMatchObject({ name: 'Wochenende', subtitle: 'Wenn Zeit ist.' })

  for (const cleared of ['   ', null]) {
    await send(lise, 'PATCH', `/api/columns/${added.id}`, { subtitle: 'Wieder da' })
    const res = await send(lise, 'PATCH', `/api/columns/${added.id}`, { subtitle: cleared })
    expect(res.status).toBe(200)
    expect((await boardOf(lise, board.id)).columns.at(-1)).toMatchObject({ name: 'Wochenende', subtitle: null })
  }
})

test('a subtitle has at most 40 characters, the Gekocht Column’s can’t be changed, and only Members change them', async () => {
  const lise = await signIn(ALLOWLISTED[20])
  const linus = await signIn(ALLOWLISTED[2])
  const board = await newBoard(lise)
  const [ideen, , gekocht] = board.columns

  expect((await send(lise, 'PATCH', `/api/columns/${ideen!.id}`, { subtitle: 'x'.repeat(41) })).status).toBe(400)
  expect((await send(lise, 'PATCH', `/api/columns/${ideen!.id}`, { subtitle: 42 })).status).toBe(400)
  expect((await send(lise, 'PATCH', `/api/columns/${ideen!.id}`, {})).status).toBe(400)
  expect((await send(lise, 'PATCH', `/api/columns/${gekocht!.id}`, { subtitle: 'Fertig' })).status).toBe(400)
  expect((await send(lise, 'PATCH', `/api/columns/${gekocht!.id}`, { subtitle: null })).status).toBe(400)
  expect((await send(linus, 'PATCH', `/api/columns/${ideen!.id}`, { subtitle: 'Linus war hier' })).status).toBe(404)
  const forty = 'x'.repeat(40)
  expect((await send(lise, 'PATCH', `/api/columns/${ideen!.id}`, { subtitle: forty })).status).toBe(200)

  expect(subtitles(await boardOf(lise, board.id))).toEqual([
    { name: 'Ideen', subtitle: forty },
    { name: 'Diese Woche', subtitle: 'Das steht an.' },
    // Fixed, so not stored: the app shows it in each viewer's language.
    { name: 'Gekocht', subtitle: null },
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
