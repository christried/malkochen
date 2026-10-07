import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
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
  columns: { id: string, isGekocht: boolean, dishes: Dish[] }[]
}

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

async function addDish(caller: Caller, title: string, link?: string): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title, placeholder: 'bowl', ...link && { source: { link } } })
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
  const dish = await addDish(ada, 'Chana Masala')

  const res = await deleteDish(ada, dish.id)

  expect(res.status).toBe(204)
  expect(await firstColumnIds(ada)).not.toContain(dish.id)
})

test('undo puts a deleted Dish back in its Column, at the position it had', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const bottom = await addDish(ada, 'Linsensuppe')
  const middle = await addDish(ada, 'Apfelkuchen')
  const top = await addDish(ada, 'Pad Thai')
  const before = await firstColumnIds(ada)
  expect(before.slice(0, 3)).toEqual([top.id, middle.id, bottom.id])

  await deleteDish(ada, middle.id)
  // A Dish added in the meantime goes on top and doesn't shift it.
  const added = await addDish(ada, 'Tacos')
  const res = await restoreDish(ada, middle.id)

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: middle.id, title: 'Apfelkuchen' })
  expect(await firstColumnIds(ada)).toEqual([added.id, ...before])
})

test('undo answers where the Dish is back: its Board, its Column and its index in Board order', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  await addDish(ada, 'Ofengemüse')
  const middle = await addDish(ada, 'Gnocchi')
  await addDish(ada, 'Ramen')
  await deleteDish(ada, middle.id)

  const restored = await (await restoreDish(ada, middle.id)).json()

  const ids = await firstColumnIds(ada)
  expect(restored).toMatchObject({ id: middle.id, placement: { boardId: board.id, columnId: board.columns[0]!.id } })
  expect(restored.placement.index).toBe(ids.indexOf(middle.id))
  expect(restored.placement.index).toBe(1)
})

// Works on a Board of its own, so as Emmy: among the API tests, she is used
// here only.
test('undo after the Dish’s Column was deleted answers the Column it went to instead', async () => {
  const emmy = await signIn(ALLOWLISTED[19])
  const created = await (await emmy.fetch('/api/boards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Spalten', emoji: '🗂️' }),
  })).json() as { id: string }
  const [ideen, dieseWoche] = (await emmy.fetch(`/api/boards/${created.id}`).then(r => r.json()) as Board).columns
  const kept = await postDish(emmy, created.id, { title: 'Bleibt', placeholder: 'bowl' }).then(r => r.json()) as Dish
  const moved = await postDish(emmy, created.id, { title: 'Wandert', placeholder: 'bowl' }).then(r => r.json()) as Dish
  await emmy.fetch(`/api/dishes/${moved.id}/move`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ columnId: dieseWoche!.id }),
  })
  await deleteDish(emmy, moved.id)
  expect((await emmy.fetch(`/api/columns/${dieseWoche!.id}`, { method: 'DELETE' })).status).toBe(204)

  const restored = await (await restoreDish(emmy, moved.id)).json()

  const after = await emmy.fetch(`/api/boards/${created.id}`).then(r => r.json()) as Board
  const ids = after.columns.find(c => c.id === ideen!.id)!.dishes.map(d => d.id)
  expect(ids).toEqual([moved.id, kept.id])
  expect(restored.placement).toEqual({ boardId: created.id, columnId: ideen!.id, index: 0 })
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
