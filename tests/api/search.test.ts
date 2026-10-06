import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Searching a Board (PRD story 36): GET /api/boards/:id/dishes?q=… finds the
// Board's Dishes whose title contains the query, in any Column. Margaret's
// and Katherine's Boards are used by this file only.

interface Dish {
  id: string
  title: string
}
interface Board {
  id: string
  columns: { id: string }[]
}

const margaret = () => signIn(ALLOWLISTED[3])
const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

async function addDish(caller: Caller, title: string): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

function moveDish(caller: Caller, dishId: string, columnId: string) {
  return caller.fetch(`/api/dishes/${dishId}/move`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ columnId }),
  })
}

function search(caller: Caller, boardId: string, q: string) {
  return caller.fetch(`/api/boards/${boardId}/dishes?q=${encodeURIComponent(q)}`)
}

async function found(caller: Caller, boardId: string, q: string): Promise<Dish[]> {
  const res = await search(caller, boardId, q)
  expect(res.status).toBe(200)
  return ((await res.json()) as { dishes: Dish[] }).dishes
}

test('finds Dishes by part of their title, ignoring case, in every Column', async () => {
  const caller = await margaret()
  const board = await landingBoard(caller)
  const idea = await addDish(caller, 'Rotes Linsen-Curry')
  const planned = await addDish(caller, 'Thai-CURRY mit Tofu')
  const cooked = await addDish(caller, 'Kichererbsencurry')
  await addDish(caller, 'Chana Masala')
  await moveDish(caller, planned.id, board.columns[1]!.id)
  await moveDish(caller, cooked.id, board.columns[2]!.id)

  const dishes = await found(caller, board.id, 'cUrRy')

  // In Board order: Ideen, Diese Woche, Gekocht.
  expect(dishes.map(d => d.id)).toEqual([idea.id, planned.id, cooked.id])
})

test('finds neither deleted Dishes nor Dishes on other Boards', async () => {
  const caller = await margaret()
  const board = await landingBoard(caller)
  const kept = await addDish(caller, 'Ofengemüse vom Blech')
  const deleted = await addDish(caller, 'Ofengemüse mit Tofu')
  await caller.fetch(`/api/dishes/${deleted.id}`, { method: 'DELETE' })
  await addDish(await signIn(ALLOWLISTED[5]), 'Ofengemüse bei Katherine')

  const dishes = await found(caller, board.id, 'ofengemüse')

  expect(dishes.map(d => d.id)).toEqual([kept.id])
})

test('% and _ in the query are just characters', async () => {
  const caller = await margaret()
  const board = await landingBoard(caller)
  const percent = await addDish(caller, '100% Vollkornbrot')
  await addDish(caller, '100 Vollkornbrötchen')

  expect((await found(caller, board.id, '100%')).map(d => d.id)).toEqual([percent.id])
  expect(await found(caller, board.id, 'Vollkorn_rot')).toEqual([])
})

test('only Members can search a Board, and a missing Board looks the same', async () => {
  const caller = await margaret()
  const board = await landingBoard(caller)
  const linus = await signIn(ALLOWLISTED[2])

  expect((await search(linus, board.id, 'curry')).status).toBe(404)
  expect((await search(caller, '00000000-0000-4000-8000-000000000000', 'curry')).status).toBe(404)
})

test('an empty query is refused', async () => {
  const caller = await margaret()
  const board = await landingBoard(caller)

  for (const q of ['', '   ']) expect((await search(caller, board.id, q)).status).toBe(400)
  expect((await caller.fetch(`/api/boards/${board.id}/dishes`)).status).toBe(400)
})
