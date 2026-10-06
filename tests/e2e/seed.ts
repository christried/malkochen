import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Page } from '@playwright/test'
import pg from 'pg'
import type { Placeholder } from '../../shared/placeholders'
import { png } from './source-lookup-stub'

// The Board the signed-in user lands on: the one used last.
export async function landingBoardId(page: Page): Promise<string> {
  const { boardId } = await (await page.request.get('/api/boards/landing')).json() as { boardId: string }
  return boardId
}

// Puts a Dish straight into the test database: for states the UI can't reach
// in a test, like a successfully stored image (the server can't download from
// the fixture hosts). tests/e2e/run.ts points DATABASE_URL at the throwaway
// database the dev server uses. `addedBy` is the email of whoever added it,
// signed in before; without it, nobody did.
export async function seedDish(page: Page, dish: { title: string, imageUrl?: string, sourceLink: string, sourceKind: string, column?: number, placeholder?: Placeholder, note?: string, addedBy?: string, creator?: string }) {
  const boardId = await landingBoardId(page)
  const board = await (await page.request.get(`/api/boards/${boardId}`)).json() as { columns: { id: string }[] }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    const { rows: [seeded] } = await client.query<{ added_by: string | null }>(
      `insert into dish (board_id, column_id, position, title, placeholder, image_url, source_link, source_kind, note, added_by, creator)
       values ($1, $2, (select coalesce(min(position), 0) - 1 from dish where column_id = $2), $3, $4, $5, $6, $7, $8, (select id from "user" where email = $9), $10)
       returning added_by`,
      [boardId, board.columns[dish.column ?? 0]!.id, dish.title, dish.placeholder ?? 'bowl', dish.imageUrl ?? null, dish.sourceLink, dish.sourceKind, dish.note ?? null, dish.addedBy ?? null, dish.creator ?? null],
    )
    if (dish.addedBy && !seeded?.added_by) throw new Error(`seedDish: ${dish.addedBy} hasn't signed in yet`)
  }
  finally {
    await client.end()
  }
}

// Gives the Dish titled `title` on the signed-in user's landing Board `count`
// Cookings, one a day back from yesterday: a Cooking History the UI would
// take many taps to build.
export async function seedCookings(page: Page, title: string, count: number) {
  const boardId = await landingBoardId(page)
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `insert into cooking (dish_id, cooked_at)
       select d.id, now() - make_interval(days => n)
       from dish d, generate_series(1, $3::int) n
       where d.board_id = $1 and d.title = $2`,
      [boardId, title, count],
    )
  }
  finally {
    await client.end()
  }
}

// Gives a Board the kind of Invite Link token Boards had before readable
// Invite Links (#128): 32 hex characters, its link /invite/<token>.
export async function seedOldInviteToken(boardId: string): Promise<string> {
  const token = randomUUID().replaceAll('-', '')
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('update board set invite_token = $2 where id = $1', [boardId, token])
  }
  finally {
    await client.end()
  }
  return token
}

// Puts the signed-in user's landing Board back as a new Board starts: named
// "Meine Küche" 🍲, with the default Columns and no Dishes. For files whose
// tests each need that start, whatever the test before them left.
export async function resetBoard(page: Page) {
  const boardId = await landingBoardId(page)
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('begin')
    await client.query(`update board set name = 'Meine Küche', emoji = '🍲' where id = $1`, [boardId])
    await replaceColumns(client, boardId, [
      { name: 'Ideen', subtitle: 'Worauf hast du Lust?' },
      { name: 'Diese Woche', subtitle: 'Das steht an.' },
      { name: 'Gekocht', subtitle: null },
    ])
    await client.query('commit')
  }
  finally {
    await client.end()
  }
}

// Empties a Board and gives it these Columns, in order, the last one the
// Gekocht Column. Inside the caller's transaction.
async function replaceColumns(client: pg.Client, boardId: string, columns: { name: string, subtitle: string | null }[]) {
  await client.query('delete from dish where board_id = $1', [boardId])
  await client.query('delete from board_column where board_id = $1', [boardId])
  for (const [position, { name, subtitle }] of columns.entries()) {
    await client.query(
      'insert into board_column (board_id, name, subtitle, position, is_gekocht) values ($1, $2, $3, $4, $5)',
      [boardId, name, subtitle, position, position === columns.length - 1],
    )
  }
}

// Gives the signed-in user's landing Board these Columns, in order, the last
// one the Gekocht Column, and no Dishes: Boards with more or fewer Columns
// than a new Board's three.
export async function setColumns(page: Page, names: string[]) {
  const boardId = await landingBoardId(page)
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('begin')
    await replaceColumns(client, boardId, names.map(name => ({ name, subtitle: null })))
    await client.query('commit')
  }
  finally {
    await client.end()
  }
}

// Stored images are served from disk here (no Blob token), as in local dev.
// A solid PNG of the given size, as the Image Store would have written it;
// removeStoredImages() deletes them again.
const IMAGE_DIR = resolve('.data/images/dishes')
const written: string[] = []

export async function storedImage(width: number, height: number): Promise<string> {
  const name = `${randomUUID()}.png`
  await mkdir(IMAGE_DIR, { recursive: true })
  await writeFile(join(IMAGE_DIR, name), png(width, height))
  written.push(join(IMAGE_DIR, name))
  return `/images/dishes/${name}`
}

export async function removeStoredImages() {
  await Promise.all(written.splice(0).map(path => rm(path, { force: true })))
}
