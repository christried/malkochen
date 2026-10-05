import { expect, test } from 'vitest'
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
