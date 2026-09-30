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

// With an `index`, as drag and drop moves it.
function moveDish(caller: Caller, dishId: string, columnId: unknown, index?: unknown) {
  return caller.fetch(`/api/dishes/${dishId}/move`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ columnId, index }),
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

test('moving a Dish to the Column it is in changes nothing', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const bottom = await addDish(barbara, 'Minestrone')
  const top = await addDish(barbara, 'Bibimbap')
  const ideen = (await landingBoard(barbara)).columns[0]!

  const res = await moveDish(barbara, bottom.id, ideen.id)

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: bottom.id, title: 'Minestrone' })
  expect((await columnDishIds(barbara))[0]!.slice(0, 2)).toEqual([top.id, bottom.id])
})

test('a Dish can’t be moved to a Column of a Board the user isn’t a Member of', async () => {
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

// Drag and drop (PRD stories 31, 32, 34): with an `index`, the Dish lands at
// that place among the target Column's other Dishes.

// The Column's ids as they should be once `dishId` is dropped at `index`.
function droppedAt(ids: string[], dishId: string, index: number): string[] {
  const others = ids.filter(id => id !== dishId)
  others.splice(index, 0, dishId)
  return others
}

test('a Dish dropped within its Column keeps the place it was dropped at', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  for (const title of ['Dal', 'Pad Thai', 'Shakshuka']) await addDish(barbara, title)
  const board = await landingBoard(barbara)
  const ideen = board.columns[0]!
  const ids = ideen.dishes.map(d => d.id)
  const shakshuka = ids[0]!

  const res = await moveDish(barbara, shakshuka, ideen.id, 2)

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: shakshuka, title: 'Shakshuka' })
  expect((await columnDishIds(barbara))[0]).toEqual(droppedAt(ids, shakshuka, 2))

  // And back up to the top.
  await moveDish(barbara, shakshuka, ideen.id, 0)
  expect((await columnDishIds(barbara))[0]).toEqual(ids)
})

test('a Dish dropped into another Column lands at the place it was dropped at', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const dish = await addDish(barbara, 'Linsensalat')
  const [, dieseWoche] = (await landingBoard(barbara)).columns
  const before = await columnDishIds(barbara)
  expect(before[1]!.length).toBeGreaterThanOrEqual(2)

  expect((await moveDish(barbara, dish.id, dieseWoche!.id, 1)).status).toBe(200)

  const after = await columnDishIds(barbara)
  expect(after[0]).toEqual(before[0]!.filter(id => id !== dish.id))
  expect(after[1]).toEqual(droppedAt(before[1]!, dish.id, 1))
})

test('a Dish dropped past the end of a Column goes to its end', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const dish = await addDish(barbara, 'Ofengemüse')
  const [, dieseWoche] = (await landingBoard(barbara)).columns
  const before = await columnDishIds(barbara)

  expect((await moveDish(barbara, dish.id, dieseWoche!.id, 999)).status).toBe(200)

  expect((await columnDishIds(barbara))[1]).toEqual([...before[1]!, dish.id])
})

test('a Dish added after reordering still goes to the top', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const ideen = (await landingBoard(barbara)).columns[0]!
  const [first] = ideen.dishes
  await moveDish(barbara, first!.id, ideen.id, 1)

  const dish = await addDish(barbara, 'Frühlingsrollen')

  expect((await columnDishIds(barbara))[0]![0]).toBe(dish.id)
})

test('the drop place must be a whole number from 0', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const dish = await addDish(barbara, 'Tomatensuppe')
  const ideen = (await landingBoard(barbara)).columns[0]!
  const before = await columnDishIds(barbara)

  for (const index of [-1, 1.5, 'oben', null]) {
    expect((await moveDish(barbara, dish.id, ideen.id, index)).status).toBe(400)
  }
  expect(await columnDishIds(barbara)).toEqual(before)
})

test('only Members can drop a Dish, and not into another Board', async () => {
  const barbara = await signIn(ALLOWLISTED[4])
  const linus = await signIn(ALLOWLISTED[2])
  const dish = await addDish(barbara, 'Barbaras Borschtsch')
  const before = await columnDishIds(barbara)
  const [ideen] = (await landingBoard(barbara)).columns
  const elsewhere = (await landingBoard(linus)).columns[1]!
  const linusBefore = await columnDishIds(linus)

  expect((await moveDish(linus, dish.id, ideen!.id, 1)).status).toBe(404)
  expect((await moveDish(barbara, dish.id, elsewhere.id, 0)).status).toBe(400)

  expect(await columnDishIds(barbara)).toEqual(before)
  expect(await columnDishIds(linus)).toEqual(linusBefore)
})
