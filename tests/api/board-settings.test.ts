import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Board settings (PRD stories 57–60, 62): renaming the Board, its emoji, and
// managing its Columns. Mary's Board is used by this file only: it reshapes
// her Columns. Linus is the non-Member.

interface Column {
  id: string
  name: string
  isGekocht: boolean
  dishes: { id: string, title: string }[]
}
interface Board {
  id: string
  name: string
  emoji: string
  columns: Column[]
}

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

function send(caller: Caller, method: string, path: string, body?: unknown) {
  return caller.fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

test('a Member renames the Board and changes its emoji', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)

  const res = await send(mary, 'PATCH', `/api/boards/${board.id}`, { name: '  Kochclub ', emoji: '🍜' })

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: board.id, name: 'Kochclub', emoji: '🍜' })
  expect(await landingBoard(mary)).toMatchObject({ name: 'Kochclub', emoji: '🍜' })
})

test('a Board needs a name and exactly one emoji, and only Members can change them', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const linus = await signIn(ALLOWLISTED[2])
  const board = await landingBoard(mary)

  for (const changes of [{ name: '   ' }, { emoji: 'ab' }, { emoji: '🍜🍝' }, { emoji: '' }, { isOwner: true }]) {
    expect((await send(mary, 'PATCH', `/api/boards/${board.id}`, changes)).status).toBe(400)
  }
  expect((await send(mary, 'PATCH', `/api/boards/${board.id}`, { emoji: '🧑‍🍳' })).status).toBe(200)
  expect((await send(linus, 'PATCH', `/api/boards/${board.id}`, { name: 'Linus’ Küche' })).status).toBe(404)
  expect(await landingBoard(mary)).toMatchObject({ name: board.name, emoji: '🧑‍🍳' })
})

// Adds a Column; it goes to the end of the Board.
async function addColumn(caller: Caller, boardId: string, name: string): Promise<Column> {
  const res = await send(caller, 'POST', `/api/boards/${boardId}/columns`, { name })
  expect(res.status).toBe(201)
  return res.json()
}

test('a Member adds a Column at the end of the Board and renames it', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)

  const added = await addColumn(mary, board.id, ' Wochenende ')

  expect(added).toMatchObject({ name: 'Wochenende', isGekocht: false })
  expect((await landingBoard(mary)).columns.map(c => c.id)).toEqual([...board.columns.map(c => c.id), added.id])

  const res = await send(mary, 'PATCH', `/api/columns/${added.id}`, { name: 'Für Gäste' })
  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: added.id, name: 'Für Gäste' })
  expect((await landingBoard(mary)).columns.at(-1)).toMatchObject({ id: added.id, name: 'Für Gäste' })
})

function reorder(caller: Caller, boardId: string, columnIds: unknown) {
  return send(caller, 'PUT', `/api/boards/${boardId}/columns`, { columnIds })
}

test('a Member reorders the Columns, the Gekocht Column too', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)
  const ids = board.columns.map(c => c.id)
  const gekocht = board.columns.find(c => c.isGekocht)!
  const order = [gekocht.id, ...ids.filter(id => id !== gekocht.id).reverse()]

  const res = await reorder(mary, board.id, order)

  expect(res.status).toBe(200)
  expect((await res.json()).map((c: Column) => c.id)).toEqual(order)
  expect((await landingBoard(mary)).columns.map(c => c.id)).toEqual(order)
  await reorder(mary, board.id, ids)
})

test('a new order names every Column of the Board exactly once', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const linus = await signIn(ALLOWLISTED[2])
  const board = await landingBoard(mary)
  const ids = board.columns.map(c => c.id)
  const elsewhere = (await landingBoard(linus)).columns[0]!.id

  for (const columnIds of [ids.slice(1), [...ids, ids[0]], [...ids.slice(1), elsewhere], 'Ideen', null]) {
    expect((await reorder(mary, board.id, columnIds)).status).toBe(400)
  }
  expect((await reorder(linus, board.id, ids.toReversed())).status).toBe(404)
  expect((await landingBoard(mary)).columns.map(c => c.id)).toEqual(ids)
})

// Deletes a Column; its Dishes, if any, go to `moveTo`.
function deleteColumn(caller: Caller, columnId: string, moveTo?: string) {
  return caller.fetch(`/api/columns/${columnId}${moveTo ? `?moveTo=${moveTo}` : ''}`, { method: 'DELETE' })
}

test('an empty Column is deleted without asking where its Dishes go', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)
  const added = await addColumn(mary, board.id, 'Irgendwann')

  expect((await deleteColumn(mary, added.id)).status).toBe(204)

  expect((await landingBoard(mary)).columns.map(c => c.id)).toEqual(board.columns.map(c => c.id))
  expect((await deleteColumn(mary, added.id)).status).toBe(404)
})

test('the Gekocht Column can’t be deleted, and a Board never gets a second one', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)
  const gekocht = board.columns.find(c => c.isGekocht)!
  const [first] = board.columns

  expect((await deleteColumn(mary, gekocht.id)).status).toBe(400)
  expect((await deleteColumn(mary, gekocht.id, first!.id)).status).toBe(400)
  expect((await send(mary, 'POST', `/api/boards/${board.id}/columns`, { name: 'Auch gekocht', isGekocht: true })).status).toBe(400)
  expect((await send(mary, 'PATCH', `/api/columns/${first!.id}`, { name: 'Ideen', isGekocht: true })).status).toBe(400)

  const after = await landingBoard(mary)
  expect(after.columns.map(c => c.id)).toEqual(board.columns.map(c => c.id))
  expect(after.columns.filter(c => c.isGekocht).map(c => c.id)).toEqual([gekocht.id])
})

async function addDish(caller: Caller, boardId: string, title: string): Promise<{ id: string }> {
  const res = await postDish(caller, boardId, { title, placeholder: 'curry' })
  expect(res.status).toBe(201)
  return res.json()
}

function moveDish(caller: Caller, dishId: string, columnId: string) {
  return send(caller, 'POST', `/api/dishes/${dishId}/move`, { columnId })
}

const dishIds = (column: Column | undefined) => column?.dishes.map(d => d.id)

test('deleting a Column with Dishes moves them, in their order, to the top of the chosen Column', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)
  const [ideen] = board.columns
  const leaving = await addColumn(mary, board.id, 'Vielleicht')
  const staying = await addDish(mary, board.id, 'Kürbissuppe')
  for (const title of ['Pilzrisotto', 'Tacos', 'Gyoza']) await moveDish(mary, (await addDish(mary, board.id, title)).id, leaving.id)
  const gone = await addDish(mary, board.id, 'Crêpes')
  await moveDish(mary, gone.id, leaving.id)
  await mary.fetch(`/api/dishes/${gone.id}`, { method: 'DELETE' })
  const moving = dishIds((await landingBoard(mary)).columns.at(-1))!
  expect(moving).toHaveLength(3)

  expect((await deleteColumn(mary, leaving.id)).status).toBe(400)
  expect((await deleteColumn(mary, leaving.id, ideen!.id)).status).toBe(204)

  const after = await landingBoard(mary)
  expect(after.columns.map(c => c.id)).toEqual(board.columns.map(c => c.id))
  expect(dishIds(after.columns[0])!.slice(0, 4)).toEqual([...moving, staying.id])
  // A Dish deleted in it went along, so undo brings it back there.
  expect((await mary.fetch(`/api/dishes/${gone.id}/restore`, { method: 'POST' })).status).toBe(200)
  expect(dishIds((await landingBoard(mary)).columns[0])).toContain(gone.id)
})

test('Dishes moved into the Gekocht Column by deleting their Column record no Cooking', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)
  const gekocht = board.columns.find(c => c.isGekocht)!
  const leaving = await addColumn(mary, board.id, 'Resteessen')
  const dish = await addDish(mary, board.id, 'Bratreis')
  await moveDish(mary, dish.id, leaving.id)

  expect((await deleteColumn(mary, leaving.id, gekocht.id)).status).toBe(204)

  const moved = (await landingBoard(mary)).columns.find(c => c.isGekocht)!.dishes.find(d => d.id === dish.id)
  expect(moved).toMatchObject({ id: dish.id, cookings: [] })
})

test('a Board keeps at least one Column besides Gekocht', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)
  const gekocht = board.columns.find(c => c.isGekocht)!
  const others = board.columns.filter(c => !c.isGekocht)
  const spare = await addColumn(mary, board.id, 'Ablage')
  for (const column of others) expect((await deleteColumn(mary, column.id, spare.id)).status).toBe(204)

  expect((await deleteColumn(mary, spare.id, gekocht.id)).status).toBe(400)

  const after = await landingBoard(mary)
  expect(after.columns.map(c => c.id).sort()).toEqual([gekocht.id, spare.id].sort())
  // Back to two Columns before Gekocht for the tests after this one.
  await send(mary, 'PATCH', `/api/columns/${spare.id}`, { name: 'Ideen' })
  const dieseWoche = await addColumn(mary, board.id, 'Diese Woche')
  await reorder(mary, board.id, [spare.id, dieseWoche.id, gekocht.id])
})

test('Dishes only move to another Column of the same Board, and only Members delete Columns', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const linus = await signIn(ALLOWLISTED[2])
  const board = await landingBoard(mary)
  const leaving = await addColumn(mary, board.id, 'Zum Löschen')
  await moveDish(mary, (await addDish(mary, board.id, 'Nudelsalat')).id, leaving.id)
  const elsewhere = (await landingBoard(linus)).columns[0]!.id

  for (const moveTo of [leaving.id, elsewhere, 'Ideen']) {
    expect((await deleteColumn(mary, leaving.id, moveTo)).status).toBe(400)
  }
  expect((await deleteColumn(linus, leaving.id, board.columns[0]!.id)).status).toBe(404)
  expect((await send(linus, 'PATCH', `/api/columns/${leaving.id}`, { name: 'Linus' })).status).toBe(404)
  expect((await send(linus, 'POST', `/api/boards/${board.id}/columns`, { name: 'Linus' })).status).toBe(404)
  expect((await landingBoard(mary)).columns.at(-1)).toMatchObject({ id: leaving.id, name: 'Zum Löschen' })
  expect((await deleteColumn(mary, leaving.id, board.columns[0]!.id)).status).toBe(204)
})

test('with the Gekocht Column first, a new Dish goes to the first Column after it', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)
  const ids = board.columns.map(c => c.id)
  const gekocht = board.columns.find(c => c.isGekocht)!
  await reorder(mary, board.id, [gekocht.id, ...ids.filter(id => id !== gekocht.id)])

  const dish = await addDish(mary, board.id, 'Ofenkartoffeln')

  const after = await landingBoard(mary)
  expect(dishIds(after.columns[0])).not.toContain(dish.id)
  expect(dishIds(after.columns[1])![0]).toBe(dish.id)
  await reorder(mary, board.id, ids)
})

test('a Dish deleted from an empty Column can still be brought back once the Column is gone', async () => {
  const mary = await signIn(ALLOWLISTED[7])
  const board = await landingBoard(mary)
  const leaving = await addColumn(mary, board.id, 'Kurz da')
  const dish = await addDish(mary, board.id, 'Zucchinipuffer')
  await moveDish(mary, dish.id, leaving.id)
  await mary.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })

  expect((await deleteColumn(mary, leaving.id)).status).toBe(204)

  expect((await mary.fetch(`/api/dishes/${dish.id}/restore`, { method: 'POST' })).status).toBe(200)
  const firstNotGekocht = (await landingBoard(mary)).columns.find(c => !c.isGekocht)
  expect(dishIds(firstNotGekocht)![0]).toBe(dish.id)
})
