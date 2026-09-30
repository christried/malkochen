import type { Page } from '@playwright/test'
import pg from 'pg'

// Puts a Dish straight into the test database: for states the UI can't reach
// in a test, like a successfully stored image (the server can't download from
// the fixture hosts). tests/e2e/run.ts points DATABASE_URL at the throwaway
// database the dev server uses.
export async function seedDish(page: Page, dish: { title: string, imageUrl?: string, sourceLink: string, sourceKind: string }) {
  const { boardId } = await (await page.request.get('/api/boards/landing')).json() as { boardId: string }
  const board = await (await page.request.get(`/api/boards/${boardId}`)).json() as { columns: { id: string }[] }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query(
      `insert into dish (board_id, column_id, position, title, placeholder, image_url, source_link, source_kind)
       values ($1, $2, (select coalesce(min(position), 0) - 1 from dish where column_id = $2), $3, 'bowl', $4, $5, $6)`,
      [boardId, board.columns[0]!.id, dish.title, dish.imageUrl ?? null, dish.sourceLink, dish.sourceKind],
    )
  }
  finally {
    await client.end()
  }
}
