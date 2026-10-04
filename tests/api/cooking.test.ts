import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Cooking (PRD stories 35, 48–55): moving a Dish into the Gekocht Column, by
// "Verschieben nach…", a drop or the "Gekocht ✓" quick action, records a
// Cooking dated now. "Rückgängig" puts the Dish back and removes it; a note
// can be added; a single Cooking can be deleted (and restored). Hedy's Board
// is used by this file only.

interface Cooking {
  id: string
  cookedAt: string
  note: string | null
  recordedBy: { id: string, name: string } | null
}
interface Dish {
  id: string
  title: string
  cookings: Cooking[]
  // The Cooking a move or "Gekocht ✓" just recorded.
  cooking?: Cooking
}
interface Board {
  id: string
  columns: { id: string, name: string, isGekocht: boolean, dishes: Dish[] }[]
}

const hedy = () => signIn(ALLOWLISTED[6])
const linus = () => signIn(ALLOWLISTED[2])
const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)
const MISSING = '00000000-0000-4000-8000-000000000000'

async function addDish(caller: Caller, title: string): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title, placeholder: 'curry' })
  expect(res.status).toBe(201)
  return res.json()
}

function post(caller: Caller, path: string, body?: unknown) {
  return caller.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const moveDish = (caller: Caller, dishId: string, columnId: string, index?: number) =>
  post(caller, `/api/dishes/${dishId}/move`, { columnId, index })
const cookDish = (caller: Caller, dishId: string) => post(caller, `/api/dishes/${dishId}/cook`)
const undoCooking = (caller: Caller, cookingId: string, columnId: unknown, index: unknown) =>
  post(caller, `/api/cookings/${cookingId}/undo`, { columnId, index })
const noteCooking = (caller: Caller, cookingId: string, note: unknown) =>
  caller.fetch(`/api/cookings/${cookingId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ note }),
  })
const deleteCooking = (caller: Caller, cookingId: string) => caller.fetch(`/api/cookings/${cookingId}`, { method: 'DELETE' })
const restoreCooking = (caller: Caller, cookingId: string) => post(caller, `/api/cookings/${cookingId}/restore`)

// The Dish as the Board shows it, and the Column it is in.
async function located(caller: Caller, dishId: string) {
  for (const column of (await landingBoard(caller)).columns) {
    const index = column.dishes.findIndex(d => d.id === dishId)
    if (index !== -1) return { dish: column.dishes[index]!, column, index }
  }
  throw new Error(`Dish ${dishId} is not on the Board`)
}

async function columnsOf(caller: Caller) {
  const { columns } = await landingBoard(caller)
  const gekocht = columns.find(c => c.isGekocht)!
  return { ideen: columns[0]!, dieseWoche: columns[1]!, gekocht }
}

test('moving a Dish into Gekocht records one Cooking dated now, by whoever moved it', async () => {
  const caller = await hedy()
  const { gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Pad Thai')
  expect(dish.cookings).toEqual([])
  const before = Date.now()

  const res = await moveDish(caller, dish.id, gekocht.id)

  expect(res.status).toBe(200)
  const moved = await res.json() as Dish
  expect(moved.cookings).toHaveLength(1)
  expect(moved.cooking).toEqual(moved.cookings[0])
  const cooking = moved.cooking!
  expect(cooking).toMatchObject({ note: null, recordedBy: { name: expect.any(String) } })
  expect(Date.parse(cooking.cookedAt)).toBeGreaterThanOrEqual(before - 5000)
  expect(Date.parse(cooking.cookedAt)).toBeLessThanOrEqual(Date.now() + 5000)
  const found = await located(caller, dish.id)
  expect(found.column.id).toBe(gekocht.id)
  expect(found.dish.cookings).toEqual([cooking])
})

test('a Dish dropped into Gekocht records a Cooking; moving within Gekocht records none', async () => {
  const caller = await hedy()
  const { gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Chana Masala')

  const dropped = await (await moveDish(caller, dish.id, gekocht.id, 1)).json() as Dish
  expect(dropped.cookings).toHaveLength(1)
  expect((await located(caller, dish.id)).index).toBe(1)

  const reordered = await (await moveDish(caller, dish.id, gekocht.id, 0)).json() as Dish
  expect(reordered.cooking).toBeUndefined()
  const again = await (await moveDish(caller, dish.id, gekocht.id)).json() as Dish
  expect(again.cooking).toBeUndefined()
  expect((await located(caller, dish.id)).dish.cookings).toHaveLength(1)
})

test('moving to another Column records no Cooking', async () => {
  const caller = await hedy()
  const { dieseWoche } = await columnsOf(caller)
  const dish = await addDish(caller, 'Dal')

  const moved = await (await moveDish(caller, dish.id, dieseWoche.id)).json() as Dish

  expect(moved.cooking).toBeUndefined()
  expect(moved.cookings).toEqual([])
})

test('the history is kept when the Dish moves out of Gekocht, and cooking again adds a Cooking', async () => {
  const caller = await hedy()
  const { ideen, gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Ramen')
  const first = (await (await moveDish(caller, dish.id, gekocht.id)).json() as Dish).cooking!

  const out = await (await moveDish(caller, dish.id, ideen.id)).json() as Dish
  expect(out.cookings).toEqual([first])

  const second = (await (await moveDish(caller, dish.id, gekocht.id)).json() as Dish).cooking!
  expect(second.id).not.toBe(first.id)
  // Newest first.
  expect((await located(caller, dish.id)).dish.cookings.map(c => c.id)).toEqual([second.id, first.id])
})

test('"Gekocht ✓" moves the Dish to the top of Gekocht and records a Cooking', async () => {
  const caller = await hedy()
  const { gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Gnocchi')

  const res = await cookDish(caller, dish.id)

  expect(res.status).toBe(200)
  const cooked = await res.json() as Dish
  expect(cooked.cookings).toEqual([cooked.cooking])
  const found = await located(caller, dish.id)
  expect(found.column.id).toBe(gekocht.id)
  expect(found.index).toBe(0)
})

test('"Gekocht ✓" on a Dish already in Gekocht records another Cooking and leaves it where it is', async () => {
  const caller = await hedy()
  const { gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Bibimbap')
  await moveDish(caller, dish.id, gekocht.id, 1)

  const cooked = await (await cookDish(caller, dish.id)).json() as Dish

  expect(cooked.cookings).toHaveLength(2)
  expect(cooked.cookings[0]).toEqual(cooked.cooking)
  const found = await located(caller, dish.id)
  expect(found.column.id).toBe(gekocht.id)
  expect(found.index).toBe(1)
})

test('undo puts the Dish back where it was and removes that Cooking', async () => {
  const caller = await hedy()
  const { dieseWoche, gekocht } = await columnsOf(caller)
  for (const title of ['Linsensuppe', 'Tacos']) {
    const added = await addDish(caller, title)
    await moveDish(caller, added.id, dieseWoche.id)
  }
  const dish = await addDish(caller, 'Pho')
  await moveDish(caller, dish.id, dieseWoche.id, 1)
  const earlier = (await (await cookDish(caller, dish.id)).json() as Dish).cooking!
  await moveDish(caller, dish.id, dieseWoche.id, 1)
  const before = (await columnsOf(caller)).dieseWoche.dishes.map(d => d.id)
  const cooking = (await (await moveDish(caller, dish.id, gekocht.id)).json() as Dish).cooking!

  const res = await undoCooking(caller, cooking.id, dieseWoche.id, 1)

  expect(res.status).toBe(200)
  const undone = await res.json() as Dish
  expect(undone.cookings).toEqual([earlier])
  expect((await columnsOf(caller)).dieseWoche.dishes.map(d => d.id)).toEqual(before)
  expect((await located(caller, dish.id)).dish.cookings).toEqual([earlier])
  // Once undone, it is gone: a second undo finds nothing.
  expect((await undoCooking(caller, cooking.id, dieseWoche.id, 1)).status).toBe(404)
})

test('undoing "Gekocht ✓" on a Dish already in Gekocht only removes the Cooking', async () => {
  const caller = await hedy()
  const { gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Kimchi-Pfanne')
  const first = (await (await moveDish(caller, dish.id, gekocht.id)).json() as Dish).cooking!
  const { index } = await located(caller, dish.id)
  const second = (await (await cookDish(caller, dish.id)).json() as Dish).cooking!

  expect((await undoCooking(caller, second.id, gekocht.id, index)).status).toBe(200)

  const found = await located(caller, dish.id)
  expect(found.column.id).toBe(gekocht.id)
  expect(found.index).toBe(index)
  expect(found.dish.cookings).toEqual([first])
})

test('once the Dish has left Gekocht again, undo is refused and the Cooking stays', async () => {
  const caller = await hedy()
  const { ideen, dieseWoche } = await columnsOf(caller)
  const dish = await addDish(caller, 'Tomatensuppe')
  const cooking = (await (await cookDish(caller, dish.id)).json() as Dish).cooking!
  // Another Member moves it on before the toast's undo arrives.
  await moveDish(caller, dish.id, dieseWoche.id)

  expect((await undoCooking(caller, cooking.id, ideen.id, 0)).status).toBe(400)

  const found = await located(caller, dish.id)
  expect(found.column.id).toBe(dieseWoche.id)
  expect(found.dish.cookings).toEqual([cooking])
})

test('undo needs a Column of the Dish’s Board and a place', async () => {
  const caller = await hedy()
  const other = await linus()
  const { gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Frühlingsrollen')
  const cooking = (await (await cookDish(caller, dish.id)).json() as Dish).cooking!
  const elsewhere = (await landingBoard(other)).columns[0]!

  for (const [columnId, index] of [[undefined, 0], ['Ideen', 0], [gekocht.id, -1], [gekocht.id, 'oben']]) {
    expect((await undoCooking(caller, cooking.id, columnId, index)).status).toBe(400)
  }
  expect((await undoCooking(caller, cooking.id, elsewhere.id, 0)).status).toBe(400)
  expect((await undoCooking(caller, cooking.id, MISSING, 0)).status).toBe(400)

  const found = await located(caller, dish.id)
  expect(found.column.id).toBe(gekocht.id)
  expect(found.dish.cookings).toEqual([cooking])
})

test('cooking and its undo answer where the Dish now is, in Board order, with the Cooking recorded', async () => {
  const caller = await hedy()
  const { id: boardId } = await landingBoard(caller)
  const { gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Linsendal')
  const before = await located(caller, dish.id)

  const cooked = await (await cookDish(caller, dish.id)).json()
  expect(cooked.placement).toEqual({ boardId, columnId: gekocht.id, index: 0 })
  expect(cooked.cookings).toEqual([cooked.cooking])
  const dropped = await (await moveDish(caller, dish.id, gekocht.id, 1)).json()
  expect(dropped.cooking).toBeUndefined()
  expect(dropped.placement).toEqual({ boardId, columnId: gekocht.id, index: (await located(caller, dish.id)).index })

  const undone = await (await undoCooking(caller, cooked.cooking.id, before.column.id, before.index)).json()
  expect(undone.placement).toEqual({ boardId, columnId: before.column.id, index: before.index })
  expect(undone.cookings).toEqual([])
  expect((await located(caller, dish.id)).index).toBe(before.index)
})

test('a note can be added to a Cooking, changed and removed', async () => {
  const caller = await hedy()
  const dish = await addDish(caller, 'Ofengemüse')
  const cooking = (await (await cookDish(caller, dish.id)).json() as Dish).cooking!

  const res = await noteCooking(caller, cooking.id, '  mit Räuchertofu besser  ')

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ...cooking, note: 'mit Räuchertofu besser' })
  expect((await located(caller, dish.id)).dish.cookings[0]!.note).toBe('mit Räuchertofu besser')

  expect(await (await noteCooking(caller, cooking.id, '   ')).json()).toMatchObject({ note: null })
  expect((await noteCooking(caller, cooking.id, 'x'.repeat(2001))).status).toBe(400)
  expect((await noteCooking(caller, cooking.id, 42)).status).toBe(400)
})

test('a single Cooking can be deleted, and restored', async () => {
  const caller = await hedy()
  const { ideen, gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Minestrone')
  const first = (await (await moveDish(caller, dish.id, gekocht.id)).json() as Dish).cooking!
  await moveDish(caller, dish.id, ideen.id)
  const second = (await (await moveDish(caller, dish.id, gekocht.id)).json() as Dish).cooking!

  const res = await deleteCooking(caller, first.id)

  expect(res.status).toBe(204)
  const found = await located(caller, dish.id)
  expect(found.dish.cookings).toEqual([second])
  expect(found.column.id).toBe(gekocht.id)
  expect((await deleteCooking(caller, first.id)).status).toBe(404)
  expect((await noteCooking(caller, first.id, 'weg')).status).toBe(404)

  const restored = await restoreCooking(caller, first.id)
  expect(restored.status).toBe(200)
  expect(await restored.json()).toEqual(first)
  expect((await located(caller, dish.id)).dish.cookings).toEqual([second, first])
})

test('only Members can cook, undo, note, delete or restore; missing ones look the same', async () => {
  const caller = await hedy()
  const other = await linus()
  const { gekocht } = await columnsOf(caller)
  const dish = await addDish(caller, 'Hedys Curry')
  const cooking = (await (await cookDish(caller, dish.id)).json() as Dish).cooking!

  expect((await cookDish(other, dish.id)).status).toBe(404)
  expect((await undoCooking(other, cooking.id, gekocht.id, 0)).status).toBe(404)
  expect((await noteCooking(other, cooking.id, 'lecker')).status).toBe(404)
  expect((await deleteCooking(other, cooking.id)).status).toBe(404)
  expect((await restoreCooking(other, cooking.id)).status).toBe(404)
  expect((await located(caller, dish.id)).dish.cookings).toEqual([cooking])

  for (const id of [MISSING, 'not-a-cooking']) {
    expect((await noteCooking(caller, id, 'lecker')).status).toBe(404)
    expect((await deleteCooking(caller, id)).status).toBe(404)
    expect((await restoreCooking(caller, id)).status).toBe(404)
    expect((await undoCooking(caller, id, gekocht.id, 0)).status).toBe(404)
    expect((await cookDish(caller, id)).status).toBe(404)
  }

  await caller.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })
  expect((await cookDish(caller, dish.id)).status).toBe(404)
})
