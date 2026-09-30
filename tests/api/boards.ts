import type { Caller } from './client'

// Shared steps of the API tests that work on a user's landing Board. Each
// test file types the Board as far as it looks into it.

export async function landingBoard<Board = { id: string }>(caller: Caller): Promise<Board> {
  const { boardId } = await (await caller.fetch('/api/boards/landing')).json() as { boardId: string }
  return (await caller.fetch(`/api/boards/${boardId}`)).json() as Promise<Board>
}

// POST /api/boards/:id/dishes, answered as is.
export function postDish(caller: Caller, boardId: string, body: unknown): Promise<Response> {
  return caller.fetch(`/api/boards/${boardId}/dishes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
