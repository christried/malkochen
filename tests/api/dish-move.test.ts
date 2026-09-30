import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Moving a Dish to another Column (PRD story 33): POST /api/dishes/:id/move
// puts it at the top of the target Column on the same Board. Barbara's Board
// is used by this file only: the others expect nothing beyond their first Column.

interface Dish {
  id: string
  title: string
}
interface Board {
  id: string
  columns: { id: string, name: string, dishes: Dish[] }[]
}

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

async function addDish(caller: Caller, title: string): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title, placeholder: 'curry' })
  expect(res.status).toBe(201)
  return res.json()
}

function moveDish(caller: Caller, dishId: string, columnId: unknown) {
  return caller.fetch(`/api/dishes/${dishId}/move`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ columnId }),
  })
}

// The Dish ids of each Column of the landing Board, in Board order.
async function columnDishIds(caller: Caller): Promise<string[][]> {
  return (await landingBoard(caller)).columns.map(c => c.dishes.map(d => d.id))
}

test('a moved Dish goes to the top of the target Column', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const { columns: [, dieseWoche] } = await landingBoard(barbara)
  const waiting = await addDish(barbara, 'Ramen')
  await moveDish(barbara, waiting.id, dieseWoche!.id)
  const dish = await addDish(barbara, 'Gnocchi')

  const res = await moveDish(barbara, dish.id, dieseWoche!.id)

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: dish.id, title: 'Gnocchi' })
  const [ideenIds, dieseWocheIds] = await columnDishIds(barbara)
  expect(ideenIds).not.toContain(dish.id)
  expect(dieseWocheIds!.slice(0, 2)).toEqual([dish.id, waiting.id])
})

test('a Dish moved within its own Column goes to the top of it', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const bottom = await addDish(barbara, 'Minestrone')
  const top = await addDish(barbara, 'Bibimbap')
  const ideen = (await landingBoard(barbara)).columns[0]!

  expect((await moveDish(barbara, bottom.id, ideen.id)).status).toBe(200)

  expect((await columnDishIds(barbara))[0]!.slice(0, 2)).toEqual([bottom.id, top.id])
})

test('a Dish can’t be moved to a Column of another Board', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const linus = await signIn(ALLOWLISTED[2])
  const dish = await addDish(barbara, 'Falafel')
  const before = await columnDishIds(barbara)
  const elsewhere = (await landingBoard(linus)).columns[1]!

  const res = await moveDish(barbara, dish.id, elsewhere.id)

  expect(res.status).toBe(400)
  expect(await columnDishIds(barbara)).toEqual(before)
  expect((await landingBoard(linus)).columns[1]!.dishes.map(d => d.id)).not.toContain(dish.id)
})

test('the target must be a Column id', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const dish = await addDish(barbara, 'Kimchi')

  for (const columnId of [undefined, 'Diese Woche', 42]) {
    expect((await moveDish(barbara, dish.id, columnId)).status).toBe(400)
  }
  expect((await moveDish(barbara, dish.id, '00000000-0000-4000-8000-000000000000')).status).toBe(400)
})

test('only Members can move a Dish, and a missing or deleted Dish looks the same', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const linus = await signIn(ALLOWLISTED[2])
  const dish = await addDish(barbara, 'Barbaras Pho')
  const dieseWoche = (await landingBoard(barbara)).columns[1]!

  expect((await moveDish(linus, dish.id, dieseWoche.id)).status).toBe(404)
  expect((await columnDishIds(barbara))[0]).toContain(dish.id)

  await barbara.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })
  expect((await moveDish(barbara, dish.id, dieseWoche.id)).status).toBe(404)

  for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-dish']) {
    expect((await moveDish(barbara, id, dieseWoche.id)).status).toBe(404)
  }
})
