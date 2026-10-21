import { expect, test } from 'vitest'
import type { Permissions } from '../../shared/permissions'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Permissions on Dishes (#341, CONTEXT.md): "edit Dishes", "move Dishes"
// and "archive Dishes", each refused without it and allowed with it,
// through the real endpoints. A Member may always edit and archive the
// Dishes they added themselves, never move them without "move". Mitchell
// owns the Boards made here, Quimby joins them; both are used by this file only.

interface Dish { id: string, title: string }
interface Cooking { id: string }
interface Board {
  id: string
  inviteToken: string
  members: { id: string, name: string }[]
  columns: { id: string, isGekocht: boolean, dishes: Dish[] }[]
}

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, { method, ...body === undefined ? {} : json(body) })

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

async function newBoard(caller: Caller, name: string): Promise<Board> {
  const res = await send(caller, 'POST', '/api/boards', { name, emoji: '🍲' })
  expect(res.status).toBe(201)
  return getBoard(caller, (await res.json() as { id: string }).id)
}

// A new Board of Mitchell's that Quimby has joined, with a Dish each of them
// added, and Quimby's Permissions switched as `permissions` says.
async function sharedBoard(name: string, permissions: Partial<Permissions>) {
  const mitchell = await signIn(ALLOWLISTED[103])
  const quimby = await signIn(ALLOWLISTED[104])
  const { id, inviteToken } = await newBoard(mitchell, name)
  expect((await send(quimby, 'POST', `/api/invites/${inviteToken}/join`)).status).toBe(200)
  const theirs = await addDish(mitchell, id, `${name}: Mitchells Gericht`)
  const own = await addDish(quimby, id, `${name}: Quimbys Gericht`)
  const board = await getBoard(mitchell, id)
  const quimbyId = board.members.find(m => m.name === 'quimby')!.id
  if (Object.keys(permissions).length > 0) {
    expect((await send(mitchell, 'PATCH', `/api/boards/${id}/members/${quimbyId}/permissions`, permissions)).status).toBe(200)
  }
  return { board, mitchell, quimby, theirs, own }
}

async function addDish(caller: Caller, boardId: string, title: string): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

async function expectRefused(res: Response, permission: string) {
  expect(res.status).toBe(403)
  expect((await res.json()).data).toEqual({ permission })
}

const edit = (caller: Caller, dish: Dish, title: string) => send(caller, 'PATCH', `/api/dishes/${dish.id}`, { title })
const move = (caller: Caller, dish: Dish, columnId: string) => send(caller, 'POST', `/api/dishes/${dish.id}/move`, { columnId })
const cook = (caller: Caller, dish: Dish) => send(caller, 'POST', `/api/dishes/${dish.id}/cook`)
const archive = (caller: Caller, dish: Dish) => send(caller, 'DELETE', `/api/dishes/${dish.id}`)
const restore = (caller: Caller, dish: Dish) => send(caller, 'POST', `/api/dishes/${dish.id}/restore`)
const bulk = (caller: Caller, body: unknown) => send(caller, 'POST', '/api/dishes/bulk', body)
const second = (board: Board) => board.columns[1]!.id

test('without "edit Dishes" a Member edits only the Dishes they added', async () => {
  const { mitchell, quimby, theirs, own } = await sharedBoard('Redaktion', { editDishes: false })

  await expectRefused(await edit(quimby, theirs, 'Umbenannt'), 'editDishes')
  expect((await edit(quimby, own, 'Quimbys neuer Titel')).status).toBe(200)
  expect((await edit(mitchell, theirs, 'Mitchells neuer Titel')).status).toBe(200)
})

test('with "edit Dishes" a Member edits anyone\'s Dish', async () => {
  const { quimby, theirs } = await sharedBoard('Druckerei', {})

  expect((await edit(quimby, theirs, 'Umbenannt')).status).toBe(200)
})

test('without "move Dishes" nothing moves or cooks, the Member\'s own Dishes neither', async () => {
  const { board, mitchell, quimby, theirs, own } = await sharedBoard('Stellwerk', { moveDishes: false })

  for (const dish of [theirs, own]) {
    await expectRefused(await move(quimby, dish, second(board)), 'moveDishes')
    await expectRefused(await cook(quimby, dish), 'moveDishes')
  }
  await expectRefused(await bulk(quimby, { action: 'move', dishIds: [own.id], columnId: second(board) }), 'moveDishes')
  await expectRefused(await bulk(quimby, { action: 'place', places: [{ dishId: own.id, columnId: second(board), index: 0 }] }), 'moveDishes')
  expect((await getBoard(mitchell, board.id)).columns[0]!.dishes.map(d => d.title)).toEqual([own.title, theirs.title])

  expect((await move(mitchell, theirs, second(board))).status).toBe(200)
  expect((await cook(mitchell, own)).status).toBe(200)
})

test('without "move Dishes" a Cooking is neither taken back nor deleted', async () => {
  const { board, mitchell, quimby, own } = await sharedBoard('Kantine', {})
  const cooked = await cook(quimby, own)
  const { cooking } = await cooked.json() as { cooking: Cooking }
  const quimbyId = board.members.find(m => m.name === 'quimby')!.id
  await send(mitchell, 'PATCH', `/api/boards/${board.id}/members/${quimbyId}/permissions`, { moveDishes: false })

  await expectRefused(await send(quimby, 'POST', `/api/cookings/${cooking.id}/undo`, { columnId: board.columns[0]!.id, index: 0 }), 'moveDishes')
  await expectRefused(await send(quimby, 'DELETE', `/api/cookings/${cooking.id}`), 'moveDishes')
  expect((await send(mitchell, 'DELETE', `/api/cookings/${cooking.id}`)).status).toBe(204)
  await expectRefused(await send(quimby, 'POST', `/api/cookings/${cooking.id}/restore`), 'moveDishes')
})

test('with "move Dishes" a Member moves and cooks anyone\'s Dish', async () => {
  const { board, quimby, theirs } = await sharedBoard('Weiche', {})

  expect((await move(quimby, theirs, second(board))).status).toBe(200)
  expect((await cook(quimby, theirs)).status).toBe(200)
})

test('moving a Dish to another Board takes "add Dishes" there', async () => {
  const { board, mitchell, quimby, own } = await sharedBoard('Abfahrt', {})
  const other = await newBoard(mitchell, 'Ankunft')
  expect((await send(quimby, 'POST', `/api/invites/${other.inviteToken}/join`)).status).toBe(200)
  const quimbyId = board.members.find(m => m.name === 'quimby')!.id
  await send(mitchell, 'PATCH', `/api/boards/${other.id}/members/${quimbyId}/permissions`, { addDishes: false })

  await expectRefused(await move(quimby, own, other.columns[0]!.id), 'addDishes')
  await expectRefused(await bulk(quimby, { action: 'move', dishIds: [own.id], columnId: other.columns[0]!.id }), 'addDishes')
  expect((await move(quimby, own, second(board))).status).toBe(200)

  await send(mitchell, 'PATCH', `/api/boards/${other.id}/members/${quimbyId}/permissions`, { addDishes: true })
  expect((await move(quimby, own, other.columns[0]!.id)).status).toBe(200)
})

test('without "archive Dishes" a Member archives and restores only the Dishes they added', async () => {
  const { board, mitchell, quimby, theirs, own } = await sharedBoard('Speicher', { archiveDishes: false })

  await expectRefused(await archive(quimby, theirs), 'archiveDishes')
  expect((await archive(quimby, own)).status).toBe(204)
  expect((await restore(quimby, own)).status).toBe(200)

  expect((await archive(mitchell, theirs)).status).toBe(204)
  await expectRefused(await restore(quimby, theirs), 'archiveDishes')
  expect((await restore(mitchell, theirs)).status).toBe(200)
  expect((await getBoard(mitchell, board.id)).columns[0]!.dishes).toHaveLength(2)
})

test('without "archive Dishes" archiving several refuses all if one isn\'t the Member\'s', async () => {
  const { board, mitchell, quimby, theirs, own } = await sharedBoard('Lager', { archiveDishes: false })
  const another = await addDish(quimby, board.id, 'Lager: Quimbys zweites Gericht')

  await expectRefused(await bulk(quimby, { action: 'delete', dishIds: [own.id, theirs.id] }), 'archiveDishes')
  expect((await getBoard(mitchell, board.id)).columns[0]!.dishes).toHaveLength(3)

  expect((await bulk(quimby, { action: 'delete', dishIds: [own.id, another.id] })).status).toBe(204)
  expect((await bulk(quimby, { action: 'restore', dishIds: [own.id, another.id] })).status).toBe(200)

  expect((await bulk(mitchell, { action: 'delete', dishIds: [own.id, theirs.id] })).status).toBe(204)
  await expectRefused(await bulk(quimby, { action: 'restore', dishIds: [own.id, theirs.id] }), 'archiveDishes')
})

test('with "archive Dishes" a Member archives and restores anyone\'s Dish', async () => {
  const { quimby, theirs } = await sharedBoard('Keller', {})

  expect((await archive(quimby, theirs)).status).toBe(204)
  expect((await restore(quimby, theirs)).status).toBe(200)
})

test('a missing Dish is still not found, not refused', async () => {
  const { quimby } = await sharedBoard('Fundbüro', { editDishes: false, moveDishes: false, archiveDishes: false })
  const missing = { id: '00000000-0000-4000-8000-000000000000', title: '' }

  expect((await edit(quimby, missing, 'x')).status).toBe(404)
  expect((await cook(quimby, missing)).status).toBe(404)
  expect((await archive(quimby, missing)).status).toBe(404)
})
