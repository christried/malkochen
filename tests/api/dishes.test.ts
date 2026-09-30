import { expect, test } from 'vitest'
import { ALLOWLISTED, signIn, type Caller } from './client'

interface Dish {
  id: string
  title: string
  note: string | null
  placeholder: string
  addedBy: { name: string, image: string | null } | null
}
interface Board {
  id: string
  columns: { id: string, name: string, dishes: Dish[] }[]
}

async function landingBoard(caller: Caller): Promise<Board> {
  const { boardId } = await (await caller.fetch('/api/boards/landing')).json() as { boardId: string }
  return (await caller.fetch(`/api/boards/${boardId}`)).json()
}

function addDish(caller: Caller, boardId: string, body: unknown) {
  return caller.fetch(`/api/boards/${boardId}/dishes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const titles = (board: Board, column = 0) => board.columns[column]!.dishes.map(d => d.title)

test('a Dish added without a Source lands at the top of the first Column', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  const res = await addDish(ada, board.id, { title: '  Omas Linsensuppe ', note: 'mit Räuchertofu statt Speck', placeholder: 'eintopf' })

  expect(res.status).toBe(201)
  const created = await res.json() as Dish
  expect(created).toMatchObject({ title: 'Omas Linsensuppe', note: 'mit Räuchertofu statt Speck', placeholder: 'eintopf' })

  const after = await landingBoard(ada)
  expect(after.columns[0]!.dishes[0]).toEqual(created)
  expect(created.addedBy).toMatchObject({ name: expect.any(String) })
  expect(after.columns.slice(1).flatMap(c => c.dishes)).toEqual([])
})

test('the newest Dish goes on top and the others keep their order', async () => {
  const grace = await signIn(ALLOWLISTED[1])
  const board = await landingBoard(grace)

  for (const title of ['Dal', 'Pad Thai', 'Shakshuka']) {
    expect((await addDish(grace, board.id, { title, placeholder: 'curry' })).status).toBe(201)
  }

  expect(titles(await landingBoard(grace)).slice(0, 3)).toEqual(['Shakshuka', 'Pad Thai', 'Dal'])
})

test('the note is optional, and a blank note is no note', async () => {
  const grace = await signIn(ALLOWLISTED[1])
  const board = await landingBoard(grace)

  const without = await (await addDish(grace, board.id, { title: 'Porridge', placeholder: 'porridge' })).json()
  const blank = await (await addDish(grace, board.id, { title: 'Brot', note: '   ', placeholder: 'bread' })).json()

  expect(without.note).toBeNull()
  expect(blank.note).toBeNull()
})

test('a Dish needs a title and a known Placeholder Image', async () => {
  const linus = await signIn(ALLOWLISTED[2])
  const board = await landingBoard(linus)

  expect((await addDish(linus, board.id, { placeholder: 'pasta' })).status).toBe(400)
  expect((await addDish(linus, board.id, { title: '   ', placeholder: 'pasta' })).status).toBe(400)
  expect((await addDish(linus, board.id, { title: 'Pasta' })).status).toBe(400)
  expect((await addDish(linus, board.id, { title: 'Pasta', placeholder: 'steak' })).status).toBe(400)

  expect((await landingBoard(linus)).columns.flatMap(c => c.dishes)).toEqual([])
})

test('only Members can add Dishes to a Board', async () => {
  const adasBoard = await landingBoard(await signIn(ALLOWLISTED[0]))
  const linus = await signIn(ALLOWLISTED[2])

  expect((await addDish(linus, adasBoard.id, { title: 'Eindringling', placeholder: 'pizza' })).status).toBe(404)
  expect(titles(await landingBoard(await signIn(ALLOWLISTED[0])))).not.toContain('Eindringling')
})
