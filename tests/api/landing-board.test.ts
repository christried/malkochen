import { expect, test } from 'vitest'
import { ALLOWLISTED, signIn, type Caller } from './client'

async function landingBoard(caller: Caller) {
  const res = await caller.fetch('/api/boards/landing')
  expect(res.status).toBe(200)
  const { boardId } = await res.json() as { boardId: string }
  const board = await caller.fetch(`/api/boards/${boardId}`)
  expect(board.status).toBe(200)
  return board.json()
}

test('the first sign-in lands on a new "Meine Küche" Board owned by the user, with the default Columns', async () => {
  const linus = await signIn(ALLOWLISTED[2])

  const board = await landingBoard(linus)

  expect(board).toMatchObject({ name: 'Meine Küche', emoji: '🍲', isOwner: true })
  expect(board.columns.map((c: { name: string, isGekocht: boolean }) => [c.name, c.isGekocht])).toEqual([
    ['Ideen', false],
    ['Diese Woche', false],
    ['Gekocht', true],
  ])
})

test('signing in again lands on the same Board and creates no other', async () => {
  const first = await landingBoard(await signIn(ALLOWLISTED[0]))
  const again = await signIn(ALLOWLISTED[0])

  expect((await landingBoard(again)).id).toBe(first.id)
  const boards = await (await again.fetch('/api/boards')).json()
  expect(boards.map((b: { id: string }) => b.id)).toEqual([first.id])
})

test('landing twice at the same moment still creates exactly one Board', async () => {
  const grace = await signIn(ALLOWLISTED[1])

  const results = await Promise.all([1, 2, 3, 4].map(() => grace.fetch('/api/boards/landing').then(r => r.json())))

  expect(new Set(results.map(r => r.boardId)).size).toBe(1)
  expect(await (await grace.fetch('/api/boards')).json()).toHaveLength(1)
})

test('a Board is hidden from users who are not its Members', async () => {
  const adasBoard = await landingBoard(await signIn(ALLOWLISTED[0]))
  const grace = await signIn(ALLOWLISTED[1])

  expect((await grace.fetch(`/api/boards/${adasBoard.id}`)).status).toBe(404)
  expect((await grace.fetch('/api/boards/not-a-uuid')).status).toBe(404)
})
