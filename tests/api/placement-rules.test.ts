import { expect, test } from 'vitest'
import { columnDeletion, columnForNewDishes, landingIndex, recordsCooking } from '../../shared/placement'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Parity (PRD stories 13, 31–35, 49, 55, 57–59): the server agrees with the
// shared placement and Gekocht rules (shared/placement.ts), including where
// its atomic SQL decides on its own. Each test works on a Board of Jean's
// made for it; among the API tests, Jean is used by this file only.

interface Column {
  id: string
  name: string
  isGekocht: boolean
  dishes: { id: string, cookings: unknown[] }[]
}
interface Board {
  id: string
  columns: Column[]
}

const jean = () => signIn(ALLOWLISTED[18])

function send(caller: Caller, method: string, path: string, body?: unknown) {
  return caller.fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function boardOf(caller: Caller, boardId: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${boardId}`)).json()
}

// A new Board, with the default Columns: Ideen, Diese Woche, Gekocht.
async function newBoard(caller: Caller): Promise<Board> {
  const res = await send(caller, 'POST', '/api/boards', { name: 'Regeln', emoji: '📏' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  return boardOf(caller, id)
}

async function reorder(caller: Caller, boardId: string, columnIds: string[]) {
  expect((await send(caller, 'PUT', `/api/boards/${boardId}/columns`, { columnIds })).status).toBe(200)
}

// Adds a Dish and answers its id.
async function addDish(caller: Caller, boardId: string, title = 'Linsensuppe'): Promise<string> {
  const res = await postDish(caller, boardId, { title, placeholder: 'eintopf' })
  expect(res.status).toBe(201)
  return (await res.json() as { id: string }).id
}

// Adds a Dish and answers the Column it went to.
async function columnOfNewDish(caller: Caller, boardId: string): Promise<string | undefined> {
  const id = await addDish(caller, boardId)
  return (await boardOf(caller, boardId)).columns.find(c => c.dishes.some(d => d.id === id))?.id
}

test('new Dishes go to the Column the rule names, also once the Gekocht Column comes first', async () => {
  const caller = await jean()
  const board = await newBoard(caller)
  const [ideen, dieseWoche, gekocht] = board.columns

  expect(columnForNewDishes(board.columns)?.id).toBe(ideen!.id)
  expect(await columnOfNewDish(caller, board.id)).toBe(ideen!.id)

  await reorder(caller, board.id, [gekocht!.id, dieseWoche!.id, ideen!.id])
  const reordered = await boardOf(caller, board.id)

  expect(columnForNewDishes(reordered.columns)?.id).toBe(dieseWoche!.id)
  expect(await columnOfNewDish(caller, board.id)).toBe(dieseWoche!.id)
})

// Deletes the Column of the Board as it is now, and checks that the server
// answers as the rule does: deleted where the rule names a target, else
// refused with the rule's refusal. Answers what the rule said.
async function deleteAsRuled(caller: Caller, boardId: string, name: string, moveTo?: string) {
  const { columns } = await boardOf(caller, boardId)
  const column = columns.find(c => c.name === name)!
  const ruled = columnDeletion(columns, column, { moveTo, hasDishes: column.dishes.length > 0 })

  const res = await caller.fetch(`/api/columns/${column.id}${moveTo ? `?moveTo=${moveTo}` : ''}`, { method: 'DELETE' })

  if ('refusal' in ruled) {
    expect(res.status).toBe(400)
    expect((await res.json() as { data?: unknown }).data).toEqual({ refusal: ruled.refusal })
  }
  else {
    expect(res.status).toBe(204)
  }
  return ruled
}

test('the server refuses to delete exactly the Columns the rule refuses, for the same reason', async () => {
  const caller = await jean()
  const board = await newBoard(caller)
  const [ideen, , gekocht] = board.columns
  await columnOfNewDish(caller, board.id)

  expect(await deleteAsRuled(caller, board.id, 'Gekocht')).toEqual({ refusal: 'gekocht' })
  expect(await deleteAsRuled(caller, board.id, 'Ideen')).toEqual({ refusal: 'not-empty' })
  expect(await deleteAsRuled(caller, board.id, 'Ideen', ideen!.id)).toEqual({ refusal: 'bad-target' })
  expect(await deleteAsRuled(caller, board.id, 'Diese Woche')).toMatchObject({ target: { id: ideen!.id } })
  expect(await deleteAsRuled(caller, board.id, 'Ideen', gekocht!.id)).toEqual({ refusal: 'last' })

  expect((await boardOf(caller, board.id)).columns.map(c => c.id)).toEqual([ideen!.id, gekocht!.id])
})

// Moves the Dish to the Column (by "Gekocht ✓" with `cook`, to the Gekocht
// Column), and checks that the server records a Cooking exactly when the
// rule says. Answers what the rule said.
async function moveAsRuled(caller: Caller, boardId: string, dishId: string, to: Column, { cook = false } = {}) {
  const from = (await boardOf(caller, boardId)).columns.find(c => c.dishes.some(d => d.id === dishId))!
  const cookings = from.dishes.find(d => d.id === dishId)!.cookings.length
  const ruled = recordsCooking(from, to, { cook })

  const res = cook
    ? await send(caller, 'POST', `/api/dishes/${dishId}/cook`)
    : await send(caller, 'POST', `/api/dishes/${dishId}/move`, { columnId: to.id })

  expect(res.status).toBe(200)
  const moved = await res.json() as { cooking?: unknown, cookings: unknown[] }
  expect(moved.cooking !== undefined).toBe(ruled)
  expect(moved.cookings).toHaveLength(ruled ? cookings + 1 : cookings)
  return ruled
}

test('the server records a Cooking exactly when the rule says', async () => {
  const caller = await jean()
  const board = await newBoard(caller)
  const elsewhere = await newBoard(caller)
  const [ideen, dieseWoche, gekocht] = board.columns
  const dishId = await addDish(caller, board.id)

  expect(await moveAsRuled(caller, board.id, dishId, dieseWoche!)).toBe(false)
  expect(await moveAsRuled(caller, board.id, dishId, gekocht!)).toBe(true)
  expect(await moveAsRuled(caller, board.id, dishId, gekocht!)).toBe(false)
  expect(await moveAsRuled(caller, board.id, dishId, gekocht!, { cook: true })).toBe(true)
  expect(await moveAsRuled(caller, board.id, dishId, ideen!)).toBe(false)
  expect(await moveAsRuled(caller, board.id, dishId, gekocht!, { cook: true })).toBe(true)
  await moveAsRuled(caller, board.id, dishId, ideen!)
  // Into another Board's Gekocht Column.
  expect(await moveAsRuled(caller, board.id, dishId, elsewhere.columns.find(c => c.isGekocht)!)).toBe(true)
})

// Moves the Dish to the named Column, at `index` if given, and checks that
// it lands where the rule says. Answers what the rule said.
async function landAsRuled(caller: Caller, boardId: string, dishId: string, name: string, index?: number) {
  const to = (await boardOf(caller, boardId)).columns.find(c => c.name === name)!
  const ruled = landingIndex(to, dishId, index)

  expect((await send(caller, 'POST', `/api/dishes/${dishId}/move`, { columnId: to.id, index })).status).toBe(200)

  const landed = (await boardOf(caller, boardId)).columns.find(c => c.id === to.id)!
  expect(landed.dishes.findIndex(d => d.id === dishId)).toBe(ruled)
  return ruled
}

test('a moved Dish lands where the rule says', async () => {
  const caller = await jean()
  const board = await newBoard(caller)
  const a = await addDish(caller, board.id, 'A')
  const b = await addDish(caller, board.id, 'B')
  const c = await addDish(caller, board.id, 'C')

  // To the top of another Column.
  expect(await landAsRuled(caller, board.id, a, 'Diese Woche')).toBe(0)
  // A drop index past the end lands at the end.
  expect(await landAsRuled(caller, board.id, b, 'Diese Woche', 5)).toBe(1)
  // Already in that Column, without a drop index, it stays.
  expect(await landAsRuled(caller, board.id, b, 'Diese Woche')).toBe(1)
  // A drop index among the Column's Dishes, from another Column and within one.
  expect(await landAsRuled(caller, board.id, c, 'Diese Woche', 1)).toBe(1)
  expect(await landAsRuled(caller, board.id, a, 'Diese Woche', 2)).toBe(2)

  const dieseWoche = (await boardOf(caller, board.id)).columns.find(col => col.name === 'Diese Woche')!
  expect(dieseWoche.dishes.map(d => d.id)).toEqual([c, b, a])
})
