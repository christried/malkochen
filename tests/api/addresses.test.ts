import 'dotenv/config'
import pg from 'pg'
import { expect, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'
import { landingBoard, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Readable addresses (issue #127, CONTEXT.md: Address): a Board is at
// /b/<slug>, a Dish at /b/<Board slug>/<title slug>-<code>, and every
// address a Board or Dish had before, by slug or by id, forwards to the
// current one. Maryam and Jocelyn are used by this file only; Linus is
// the non-Member, who joins no Board here.
// Board slugs are unique across the database every API test file shares, so
// these Boards have names no other file uses.

interface Board {
  id: string
  slug: string
  name: string
  columns: { id: string, dishes: { id: string, title: string, code: string }[] }[]
}

interface Address {
  boardId: string
  slug: string
  dish: string | null
}

function send(caller: Caller, method: string, path: string, body?: unknown) {
  return caller.fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function createBoard(caller: Caller, name: string): Promise<Board> {
  const res = await send(caller, 'POST', '/api/boards', { name, emoji: '🍜' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  return (await caller.fetch(`/api/boards/${id}`)).json() as Promise<Board>
}

async function addressOf(caller: Caller, board: string, dish?: string): Promise<Address> {
  const res = await caller.fetch(`/api/addresses/${encodeURIComponent(board)}${dish === undefined ? '' : `?dish=${encodeURIComponent(dish)}`}`)
  expect(res.status).toBe(200)
  return res.json() as Promise<Address>
}

test('a Board’s address is made from its name; another Board of that name gets a number', async () => {
  const maryam = await signIn(ALLOWLISTED[31])

  const first = await send(maryam, 'POST', '/api/boards', { name: 'Adressküche', emoji: '🍜' })
  expect(await first.json()).toMatchObject({ name: 'Adressküche', slug: 'adresskueche' })
  const second = await send(maryam, 'POST', '/api/boards', { name: '🍲 ADRESSKÜCHE!', emoji: '🍲' })
  const { id, slug } = await second.json() as Board
  expect(slug).toBe('adresskueche-2')

  expect((await (await maryam.fetch(`/api/boards/${id}`)).json() as Board).slug).toBe('adresskueche-2')
  const listed = await (await maryam.fetch('/api/boards')).json() as Board[]
  expect(listed.filter(b => b.slug.startsWith('adresskueche')).map(b => b.slug)).toEqual(['adresskueche', 'adresskueche-2'])
})

test('a Board’s address and its id both lead to it, for its Members only', async () => {
  const maryam = await signIn(ALLOWLISTED[31])
  const linus = await signIn(ALLOWLISTED[2])
  const board = await createBoard(maryam, 'Nur für Mitglieder')
  expect(board.slug).toBe('nur-fuer-mitglieder')

  expect(await addressOf(maryam, 'nur-fuer-mitglieder')).toEqual({ boardId: board.id, slug: 'nur-fuer-mitglieder', dish: null })
  expect(await addressOf(maryam, board.id)).toEqual({ boardId: board.id, slug: 'nur-fuer-mitglieder', dish: null })

  // To anyone else, it is no different from an address no Board has.
  const unknown = await maryam.fetch('/api/addresses/gibt-es-nicht-xyz')
  const notTheirs = await linus.fetch('/api/addresses/nur-fuer-mitglieder')
  const notTheirsById = await linus.fetch(`/api/addresses/${board.id}`)
  for (const res of [unknown, notTheirs, notTheirsById]) {
    expect(res.status).toBe(404)
    expect((await res.json()).statusMessage).toBe('Board not found')
  }
})

test('renaming a Board gives it a new address; the old one forwards there, and renaming back takes it again', async () => {
  const maryam = await signIn(ALLOWLISTED[31])
  const board = await createBoard(maryam, 'Vorher')

  const renamed = await send(maryam, 'PATCH', `/api/boards/${board.id}`, { name: 'Nachher Küche' })
  expect(await renamed.json()).toMatchObject({ name: 'Nachher Küche', slug: 'nachher-kueche' })
  expect(await addressOf(maryam, 'vorher')).toMatchObject({ boardId: board.id, slug: 'nachher-kueche' })
  expect(await addressOf(maryam, 'nachher-kueche')).toMatchObject({ boardId: board.id, slug: 'nachher-kueche' })

  // A new emoji keeps the address.
  const emoji = await send(maryam, 'PATCH', `/api/boards/${board.id}`, { emoji: '🥕' })
  expect(await emoji.json()).toMatchObject({ slug: 'nachher-kueche' })

  // The old address stays this Board's: another Board of that name gets a number.
  expect((await createBoard(maryam, 'Vorher')).slug).toBe('vorher-2')

  const back = await send(maryam, 'PATCH', `/api/boards/${board.id}`, { name: 'Vorher' })
  expect(await back.json()).toMatchObject({ slug: 'vorher' })
  expect(await addressOf(maryam, 'nachher-kueche')).toMatchObject({ boardId: board.id, slug: 'vorher' })
})

test('a Dish’s address ends in its code, which finds it whatever title or old id comes with it', async () => {
  const maryam = await signIn(ALLOWLISTED[31])
  const board = await createBoard(maryam, 'Gerichte mit Adresse')
  const added = await (await postDish(maryam, board.id, { title: 'Omas Linsensuppe', placeholder: 'eintopf' })).json() as { id: string, code: string }
  expect(added.code).toMatch(/^[2-9a-hjkmnp-z]{4}$/)
  const other = await (await postDish(maryam, board.id, { title: 'Omas Linsensuppe', placeholder: 'eintopf' })).json() as { code: string }
  expect(other.code).not.toBe(added.code)

  const onBoard = await (await maryam.fetch(`/api/boards/${board.id}`)).json() as Board
  expect(onBoard.columns.flatMap(c => c.dishes).find(d => d.id === added.id)?.code).toBe(added.code)

  const current = `omas-linsensuppe-${added.code}`
  expect(await addressOf(maryam, board.slug, current)).toEqual({ boardId: board.id, slug: board.slug, dish: current })
  expect(await addressOf(maryam, board.slug, `alter-titel-${added.code}`)).toMatchObject({ dish: current })
  expect(await addressOf(maryam, board.id, added.id)).toMatchObject({ slug: board.slug, dish: current })

  // Renamed, its address follows the title.
  await send(maryam, 'PATCH', `/api/dishes/${added.id}`, { title: 'Linsen-Dal 🍛' })
  expect(await addressOf(maryam, board.slug, current)).toMatchObject({ dish: `linsen-dal-${added.code}` })

  // A Dish address that isn't on the Board is left as it is.
  expect(await addressOf(maryam, board.slug, 'gibt-es-nicht-zzzz')).toMatchObject({ dish: 'gibt-es-nicht-zzzz' })

  // So is a deleted Dish's.
  await send(maryam, 'DELETE', `/api/dishes/${added.id}`)
  expect(await addressOf(maryam, board.slug, `linsen-dal-${added.code}`)).toEqual({ boardId: board.id, slug: board.slug, dish: `linsen-dal-${added.code}` })
})

test('a Dish moved to another Board: its old address forwards there, for that Board’s Members only', async () => {
  const maryam = await signIn(ALLOWLISTED[31])
  const jocelyn = await signIn(ALLOWLISTED[32])
  const from = await createBoard(maryam, 'Umzug von hier')
  const to = await createBoard(maryam, 'Umzug nach dort')
  const added = await (await postDish(maryam, from.id, { title: 'Reisender Eintopf', placeholder: 'eintopf' })).json() as { id: string, code: string }
  const current = `reisender-eintopf-${added.code}`

  // Jocelyn is a Member of the Board it leaves, not of the one it goes to.
  const { inviteToken } = await (await maryam.fetch(`/api/boards/${from.id}`)).json() as { inviteToken: string }
  expect((await send(jocelyn, 'POST', `/api/invites/${inviteToken}/join`)).status).toBe(200)

  expect((await send(maryam, 'POST', `/api/dishes/${added.id}/move`, { columnId: to.columns[0]!.id })).status).toBe(200)

  expect(await addressOf(maryam, from.slug, current)).toEqual({ boardId: to.id, slug: to.slug, dish: current })
  expect(await addressOf(maryam, from.id, added.id)).toEqual({ boardId: to.id, slug: to.slug, dish: current })
  // To Jocelyn, it is a Dish address that isn't on the Board.
  expect(await addressOf(jocelyn, from.slug, current)).toEqual({ boardId: from.id, slug: from.slug, dish: current })
})

test('a Board’s former address, too, looks to a non-Member like one no Board has', async () => {
  const maryam = await signIn(ALLOWLISTED[31])
  const linus = await signIn(ALLOWLISTED[2])
  const board = await createBoard(maryam, 'Früherer Name')
  await send(maryam, 'PATCH', `/api/boards/${board.id}`, { name: 'Späterer Name' })

  const res = await linus.fetch(`/api/addresses/${board.slug}`)
  expect(res.status).toBe(404)
  expect((await res.json()).statusMessage).toBe('Board not found')
})

test('where the app opens names the Board’s address too', async () => {
  const maryam = await signIn(ALLOWLISTED[31])
  const landing = await (await maryam.fetch('/api/boards/landing')).json() as { boardId: string, slug: string }
  const board = await landingBoard<Board>(maryam)
  expect(landing).toEqual({ boardId: board.id, slug: board.slug })
})

test('the migration gives existing Boards addresses from their names, oldest first, and every Dish a code of its own', async () => {
  const before = await migrationsBefore('0013_readable_addresses')
  const database = await createThrowawayDatabase(readAdminUrl(), before.folder)
  const client = new pg.Client({ connectionString: database.url })
  try {
    await client.connect()
    await client.query(`
      insert into board (name, emoji, created_at) values
        ('Meine Küche', '🍲', now() - interval '3 days'),
        ('MEINE KÜCHE', '🍲', now() - interval '2 days'),
        ('🍜', '🍜', now() - interval '1 day'),
        ('Crème brûlée & Straße', '🍮', now())
    `)
    await client.query(`
      insert into board_column (board_id, name, position, is_gekocht)
      select id, 'Ideen', 0, false from board
    `)
    await client.query(`
      insert into dish (board_id, column_id, position, title, placeholder)
      select board_id, id, n, 'Gericht ' || n, 'eintopf' from board_column, generate_series(1, 50) n
    `)

    await migrateDatabase(database.url)

    const boards = await client.query('select name, slug from board order by created_at')
    expect(boards.rows).toEqual([
      { name: 'Meine Küche', slug: 'meine-kueche' },
      { name: 'MEINE KÜCHE', slug: 'meine-kueche-2' },
      { name: '🍜', slug: 'board' },
      { name: 'Crème brûlée & Straße', slug: 'creme-brulee-strasse' },
    ])
    const slugs = await client.query('select slug from board_slug order by slug')
    expect(slugs.rows.map(r => r.slug)).toEqual(['board', 'creme-brulee-strasse', 'meine-kueche', 'meine-kueche-2'])

    const codes = (await client.query<{ code: string }>('select code from dish')).rows.map(r => r.code)
    expect(codes).toHaveLength(200)
    expect(new Set(codes).size).toBe(200)
    for (const code of codes) expect(code).toMatch(/^[2-9a-hjkmnp-z]{4}$/)
  }
  finally {
    await client.end()
    await database.drop()
    await before.remove()
  }
})
