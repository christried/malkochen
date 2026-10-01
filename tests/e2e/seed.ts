import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Page } from '@playwright/test'
import pg from 'pg'
import type { Placeholder } from '../../shared/placeholders'
import { png } from './source-lookup-stub'

// Puts a Dish straight into the test database: for states the UI can't reach
// in a test, like a successfully stored image (the server can't download from
// the fixture hosts). tests/e2e/run.ts points DATABASE_URL at the throwaway
// database the dev server uses.
export async function seedDish(page: Page, dish: { title: string, imageUrl?: string, sourceLink: string, sourceKind: string, column?: number, placeholder?: Placeholder, note?: string }) {
  const { boardId } = await (await page.request.get('/api/boards/landing')).json() as { boardId: string }
  const board = await (await page.request.get(`/api/boards/${boardId}`)).json() as { columns: { id: string }[] }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `insert into dish (board_id, column_id, position, title, placeholder, image_url, source_link, source_kind, note)
       values ($1, $2, (select coalesce(min(position), 0) - 1 from dish where column_id = $2), $3, $4, $5, $6, $7, $8)`,
      [boardId, board.columns[dish.column ?? 0]!.id, dish.title, dish.placeholder ?? 'bowl', dish.imageUrl ?? null, dish.sourceLink, dish.sourceKind, dish.note ?? null],
    )
  }
  finally {
    await client.end()
  }
}

// Gives the Dish titled `title` on the signed-in user's landing Board `count`
// Cookings, one a day back from yesterday: a Cooking History the UI would
// take many taps to build.
export async function seedCookings(page: Page, title: string, count: number) {
  const { boardId } = await (await page.request.get('/api/boards/landing')).json() as { boardId: string }
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

// Puts the signed-in user's landing Board back as a new Board starts: named
// "Meine Küche" 🍳, with the default Columns and no Dishes. For files whose
// tests each need that start, whatever the test before them left.
export async function resetBoard(page: Page) {
  const { boardId } = await (await page.request.get('/api/boards/landing')).json() as { boardId: string }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query('begin')
    await client.query(`update board set name = 'Meine Küche', emoji = '🍳' where id = $1`, [boardId])
    await client.query('delete from dish where board_id = $1', [boardId])
    await client.query('delete from board_column where board_id = $1', [boardId])
    await client.query(
      `insert into board_column (board_id, name, position, is_gekocht)
       values ($1, 'Ideen', 0, false), ($1, 'Diese Woche', 1, false), ($1, 'Gekocht', 2, true)`,
      [boardId],
    )
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
