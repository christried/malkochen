import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Page } from '@playwright/test'
import pg from 'pg'
import { png } from './source-lookup-stub'

// Puts a Dish straight into the test database: for states the UI can't reach
// in a test, like a successfully stored image (the server can't download from
// the fixture hosts). tests/e2e/run.ts points DATABASE_URL at the throwaway
// database the dev server uses.
export async function seedDish(page: Page, dish: { title: string, imageUrl?: string, sourceLink: string, sourceKind: string, column?: number }) {
  const { boardId } = await (await page.request.get('/api/boards/landing')).json() as { boardId: string }
  const board = await (await page.request.get(`/api/boards/${boardId}`)).json() as { columns: { id: string }[] }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `insert into dish (board_id, column_id, position, title, placeholder, image_url, source_link, source_kind)
       values ($1, $2, (select coalesce(min(position), 0) - 1 from dish where column_id = $2), $3, 'bowl', $4, $5, $6)`,
      [boardId, board.columns[dish.column ?? 0]!.id, dish.title, dish.imageUrl ?? null, dish.sourceLink, dish.sourceKind],
    )
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
