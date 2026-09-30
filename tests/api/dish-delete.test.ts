import { expect, test } from 'vitest'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Deleting a Dish with undo (PRD story 47): DELETE /api/dishes/:id takes it
// off its Board (a soft delete); POST /api/dishes/:id/restore puts it back
// where it was.

interface Dish {
  id: string
  title: string
}
interface Board {
  id: string
  columns: { id: string, dishes: Dish[] }[]
}

async function landingBoard(caller: Caller): Promise<Board> {
  const { boardId } = await (await caller.fetch('/api/boards/landing')).json() as { boardId: string }
  return (await caller.fetch(`/api/boards/${boardId}`)).json()
}

async function addDish(caller: Caller, title: string, link?: string): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await caller.fetch(`/api/boards/${board.id}/dishes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, placeholder: 'curry', ...link && { source: { link } } }),
  })
  expect(res.status).toBe(201)
  return res.json()
}

function deleteDish(caller: Caller, dishId: string) {
  return caller.fetch(`/api/dishes/${dishId}`, { method: 'DELETE' })
}

function restoreDish(caller: Caller, dishId: string) {
  return caller.fetch(`/api/dishes/${dishId}/restore`, { method: 'POST' })
}

// The ids of the landing Board's first Column, in Board order.
async function firstColumnIds(caller: Caller): Promise<string[]> {
  return (await landingBoard(caller)).columns[0]!.dishes.map(d => d.id)
}

test('a deleted Dish is gone from its Board', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Shakshuka')

  const res = await deleteDish(ada, dish.id)

  expect(res.status).toBe(204)
  expect(await firstColumnIds(ada)).not.toContain(dish.id)
})

test('undo puts a deleted Dish back in its Column, at the position it had', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const bottom = await addDish(ada, 'Linsensuppe')
  const middle = await addDish(ada, 'Käsekuchen')
  const top = await addDish(ada, 'Pad Thai')
  const before = await firstColumnIds(ada)
  expect(before.slice(0, 3)).toEqual([top.id, middle.id, bottom.id])

  await deleteDish(ada, middle.id)
  // A Dish added in the meantime goes on top and doesn't shift it.
  const added = await addDish(ada, 'Tacos')
  const res = await restoreDish(ada, middle.id)

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: middle.id, title: 'Käsekuchen' })
  expect(await firstColumnIds(ada)).toEqual([added.id, ...before])
})

test('restoring a Dish that is not deleted changes nothing', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Porridge')
  const before = await firstColumnIds(ada)

  expect((await restoreDish(ada, dish.id)).status).toBe(200)
  expect(await firstColumnIds(ada)).toEqual(before)
})

test('a deleted Dish is no duplicate, and can’t be edited or deleted again', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const link = 'https://www.youtube.com/shorts/delDumplings1'
  const dish = await addDish(ada, 'Dumplings', link)
  const board = await landingBoard(ada)
  const duplicate = async () => ((await (await ada.fetch(`/api/boards/${board.id}/duplicate?link=${encodeURIComponent(link)}`)).json()) as { duplicate: unknown }).duplicate
  expect(await duplicate()).toMatchObject({ id: dish.id })

  await deleteDish(ada, dish.id)

  expect(await duplicate()).toBeNull()
  const edit = await ada.fetch(`/api/dishes/${dish.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Wieder da?' }),
  })
  expect(edit.status).toBe(404)
  expect((await deleteDish(ada, dish.id)).status).toBe(404)

  await restoreDish(ada, dish.id)
  expect(await duplicate()).toMatchObject({ id: dish.id, title: 'Dumplings' })
})

test('only Members of its Board can delete or restore a Dish, and a missing Dish looks the same', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Adas Curry')
  const linus = await signIn(ALLOWLISTED[2])

  expect((await deleteDish(linus, dish.id)).status).toBe(404)
  expect(await firstColumnIds(ada)).toContain(dish.id)

  await deleteDish(ada, dish.id)
  expect((await restoreDish(linus, dish.id)).status).toBe(404)
  expect(await firstColumnIds(ada)).not.toContain(dish.id)

  for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-dish']) {
    expect((await deleteDish(ada, id)).status).toBe(404)
    expect((await restoreDish(ada, id)).status).toBe(404)
  }
})
