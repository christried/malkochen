import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Several Boards (PRD stories 12, 39, 46, 61): creating a Board, listing the
// user's Boards, and moving a Dish to a Column on another Board. Annie is
// used by this file only: it gives her more Boards. Linus is the non-Member.

interface Column {
  id: string
  name: string
  isGekocht: boolean
  dishes: { id: string, title: string, cookings: { id: string }[] }[]
}
interface Board {
  id: string
  name: string
  emoji: string
  isOwner: boolean
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

async function createBoard(caller: Caller, name: string, emoji: string): Promise<Board> {
  const res = await send(caller, 'POST', '/api/boards', { name, emoji })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

test('a new Board gets the default Columns and whoever creates it as Owner', async () => {
  const annie = await signIn(ALLOWLISTED[9])
  await landingBoard(annie)

  const res = await send(annie, 'POST', '/api/boards', { name: '  Kochclub ', emoji: '🍜' })

  expect(res.status).toBe(201)
  const created = await res.json()
  expect(created).toMatchObject({ name: 'Kochclub', emoji: '🍜', isOwner: true })
  const board = await (await annie.fetch(`/api/boards/${created.id}`)).json() as Board
  expect(board).toMatchObject({ id: created.id, name: 'Kochclub', emoji: '🍜', isOwner: true })
  expect(board.columns.map(c => [c.name, c.isGekocht, c.dishes.length])).toEqual([
    ['Ideen', false, 0],
    ['Diese Woche', false, 0],
    ['Gekocht', true, 0],
  ])
})

test('a new Board needs a name and exactly one emoji', async () => {
  const annie = await signIn(ALLOWLISTED[9])
  const before = await (await annie.fetch('/api/boards')).json() as { id: string }[]

  for (const body of [{ name: '   ', emoji: '🍜' }, { name: 'Kochclub', emoji: '🍜🍝' }, { name: 'Kochclub' }, { name: 'Kochclub', emoji: '🍜', isOwner: false }]) {
    expect((await send(annie, 'POST', '/api/boards', body)).status).toBe(400)
  }
  expect(await (await annie.fetch('/api/boards')).json()).toHaveLength(before.length)
})

test('the Board list shows all the user’s Boards, oldest first, however recently each was opened', async () => {
  const annie = await signIn(ALLOWLISTED[9])
  const landing = await landingBoard(annie)
  const first = await createBoard(annie, 'WG', '🏠')
  const second = await createBoard(annie, 'Backen', '🍰')
  await postDish(annie, first.id, { title: 'Zimtschnecken', placeholder: 'cake' })
  await send(annie, 'POST', `/api/boards/${second.id}/open`)
  await send(annie, 'POST', `/api/boards/${first.id}/open`)

  const boards = await (await annie.fetch('/api/boards')).json() as {
    id: string
    dishCount: number
    members: { name: string }[]
    columns: { id: string, name: string, isGekocht: boolean }[]
  }[]

  const ids = boards.map(b => b.id)
  expect(ids).toContain(landing.id)
  expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(second.id))
  expect(boards.find(b => b.id === first.id)).toMatchObject({
    name: 'WG',
    emoji: '🏠',
    isOwner: true,
    dishCount: 1,
    members: [{ name: expect.any(String) }],
    columns: first.columns.map(({ id, name, isGekocht }) => ({ id, name, isGekocht })),
  })
  expect(boards.find(b => b.id === second.id)).toMatchObject({ dishCount: 0 })
})

test('the app lands on the Board opened last, even when the Board left still polls once after it', async () => {
  const annie = await signIn(ALLOWLISTED[9])
  const left = await createBoard(annie, 'Verlassen', '🥟')
  const opened = await createBoard(annie, 'Daheim', '🌱')
  await send(annie, 'POST', `/api/boards/${left.id}/open`)
  await send(annie, 'POST', `/api/boards/${opened.id}/open`)

  // A poll of the Board left that was still out when the user switched.
  expect((await send(annie, 'POST', `/api/boards/${left.id}/seen`)).status).toBe(200)

  expect((await landingBoard(annie)).id).toBe(opened.id)
})

// POST /api/dishes/:id/move, answered as is.
function moveDish(caller: Caller, dishId: string, columnId: string) {
  return send(caller, 'POST', `/api/dishes/${dishId}/move`, { columnId })
}

async function addDish(caller: Caller, boardId: string, title: string): Promise<{ id: string }> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

test('a Dish moved to a Column on another Board goes to its top and keeps its Cooking History', async () => {
  const annie = await signIn(ALLOWLISTED[9])
  const from = await createBoard(annie, 'Zuhause', '🏡')
  const to = await createBoard(annie, 'Kochclub', '🍜')
  const waiting = await addDish(annie, to.id, 'Bibimbap')
  await moveDish(annie, waiting.id, to.columns[1]!.id)
  const dish = await addDish(annie, from.id, 'Ramen')
  const { cooking } = await (await send(annie, 'POST', `/api/dishes/${dish.id}/cook`)).json() as { cooking: { id: string } }

  const res = await moveDish(annie, dish.id, to.columns[1]!.id)

  expect(res.status).toBe(200)
  const moved = await res.json()
  expect(moved).toMatchObject({ id: dish.id, cookings: [{ id: cooking.id }] })
  expect(moved.cooking).toBeUndefined()
  const after = await (await annie.fetch(`/api/boards/${to.id}`)).json() as Board
  expect(after.columns[1]!.dishes.map(d => d.id)).toEqual([dish.id, waiting.id])
  expect(after.columns[1]!.dishes[0]!.cookings.map(c => c.id)).toEqual([cooking.id])
  const left = await (await annie.fetch(`/api/boards/${from.id}`)).json() as Board
  expect(left.columns.flatMap(c => c.dishes)).toEqual([])
})

test('a Dish moved into another Board’s Gekocht Column records a Cooking there', async () => {
  const annie = await signIn(ALLOWLISTED[9])
  const from = await createBoard(annie, 'Zuhause', '🏡')
  const to = await createBoard(annie, 'Kochclub', '🍜')
  const dish = await addDish(annie, from.id, 'Pad Thai')
  const gekocht = to.columns.find(c => c.isGekocht)!

  const res = await moveDish(annie, dish.id, gekocht.id)

  expect(res.status).toBe(200)
  const moved = await res.json() as { cooking?: { id: string }, cookings: { id: string }[] }
  expect(moved.cooking).toBeDefined()
  expect(moved.cookings.map(c => c.id)).toEqual([moved.cooking!.id])
  const after = await (await annie.fetch(`/api/boards/${to.id}`)).json() as Board
  expect(after.columns.find(c => c.isGekocht)!.dishes.map(d => d.id)).toEqual([dish.id])
})

// "Rückgängig" in the Gekocht toast after "Verschieben nach…" into another
// Board's Gekocht Column (#129).
test('undoing a Cooking recorded on another Board puts the Dish back where it was on its first Board', async () => {
  const annie = await signIn(ALLOWLISTED[9])
  const from = await createBoard(annie, 'Zuhause', '🏡')
  const to = await createBoard(annie, 'Kochclub', '🍜')
  const below = await addDish(annie, from.id, 'Linsensuppe')
  const dish = await addDish(annie, from.id, 'Pho')
  const above = await addDish(annie, from.id, 'Tacos')
  const ideen = from.columns[0]!
  const { cooking } = await (await moveDish(annie, dish.id, to.columns.find(c => c.isGekocht)!.id)).json() as { cooking: { id: string } }

  const res = await send(annie, 'POST', `/api/cookings/${cooking.id}/undo`, { columnId: ideen.id, index: 1 })

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: dish.id, cookings: [], placement: { boardId: from.id, columnId: ideen.id, index: 1 } })
  const back = await (await annie.fetch(`/api/boards/${from.id}`)).json() as Board
  expect(back.columns[0]!.dishes.map(d => d.id)).toEqual([above.id, dish.id, below.id])
  const left = await (await annie.fetch(`/api/boards/${to.id}`)).json() as Board
  expect(left.columns.flatMap(c => c.dishes)).toEqual([])
})

test('a Dish can’t be moved to a Board its mover isn’t a Member of, nor moved by a non-Member', async () => {
  const annie = await signIn(ALLOWLISTED[9])
  const linus = await signIn(ALLOWLISTED[2])
  const annies = await createBoard(annie, 'Zuhause', '🏡')
  const dish = await addDish(annie, annies.id, 'Chana Masala')
  const linusBoard = await landingBoard(linus)

  expect((await moveDish(annie, dish.id, linusBoard.columns[0]!.id)).status).toBe(400)
  expect((await moveDish(linus, dish.id, linusBoard.columns[0]!.id)).status).toBe(404)
  const after = await (await annie.fetch(`/api/boards/${annies.id}`)).json() as Board
  expect(after.columns[0]!.dishes.map(d => d.id)).toEqual([dish.id])
  expect((await landingBoard(linus)).columns.flatMap(c => c.dishes).map(d => d.id)).not.toContain(dish.id)
})
