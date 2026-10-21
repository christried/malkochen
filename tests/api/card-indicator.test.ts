import { expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// What a Dish's card shows of its Dish History (#335; PRD #318 stories
// 28–31): the Board answer carries each Dish's Votes and how many Comments
// it has, and, per Member, the Dishes with something new in their Dish
// History since that Member last opened them. A Comment, Vote or Cooking of
// another Member's marks the card; the Member's own don't; opening the
// Dish clears it. Yalow owns the Boards made here, Widnall joins them,
// Blodgett is the outsider; all three are used by this file only.

interface Dish { id: string, commentCount: number, votes: { up: boolean }[] }
interface Board {
  id: string
  inviteToken: string
  columns: { dishes: Dish[] }[]
  newInHistoryDishIds: string[]
}

const owner = () => signIn(ALLOWLISTED[94])
const member = () => signIn(ALLOWLISTED[95])
const outsider = () => signIn(ALLOWLISTED[96])

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) =>
  caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })

async function getBoard(caller: Caller, id: string): Promise<Board> {
  const res = await caller.fetch(`/api/boards/${id}`)
  expect(res.status).toBe(200)
  return res.json()
}

// A new Board of the owner's that the member has joined.
async function sharedBoard(name: string): Promise<{ board: Board, yalow: Caller, widnall: Caller }> {
  const yalow = await owner()
  const res = await post(yalow, '/api/boards', { name, emoji: '🥘' })
  expect(res.status).toBe(201)
  const board = await getBoard(yalow, (await res.json() as { id: string }).id)
  const widnall = await member()
  expect((await post(widnall, `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  return { board, yalow, widnall }
}

async function addDish(caller: Caller, boardId: string): Promise<{ id: string }> {
  const res = await postDish(caller, boardId, { title: 'Shakshuka', placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

async function comment(caller: Caller, dishId: string, text = 'Lecker!'): Promise<{ id: string }> {
  const res = await post(caller, `/api/dishes/${dishId}/comments`, { text })
  expect(res.status).toBe(201)
  return res.json()
}

async function cook(caller: Caller, dishId: string) {
  expect((await post(caller, `/api/dishes/${dishId}/cook`)).status).toBe(200)
}

async function vote(caller: Caller, dishId: string, up: boolean) {
  expect((await caller.fetch(`/api/dishes/${dishId}/vote`, { method: 'PUT', ...json({ up }) })).status).toBe(200)
}

// Opens the Dish's detail, as the app does: answers its Dish History.
const openDish = (caller: Caller, dishId: string) => post(caller, `/api/dishes/${dishId}/open`)

async function opened(caller: Caller, dishId: string) {
  expect((await openDish(caller, dishId)).status).toBe(200)
}

async function dishOn(caller: Caller, boardId: string, dishId: string): Promise<Dish> {
  return (await getBoard(caller, boardId)).columns.flatMap(c => c.dishes).find(d => d.id === dishId)!
}

async function isMarked(caller: Caller, boardId: string, dishId: string): Promise<boolean> {
  return (await getBoard(caller, boardId)).newInHistoryDishIds.includes(dishId)
}

test('a Dish on the Board says how many Comments it has, not counting deleted ones', async () => {
  const { board, yalow, widnall } = await sharedBoard('Kommentare zählen')
  const dish = await addDish(yalow, board.id)
  expect((await dishOn(yalow, board.id, dish.id)).commentCount).toBe(0)

  await comment(yalow, dish.id)
  const theirs = await comment(widnall, dish.id)
  expect((await dishOn(yalow, board.id, dish.id)).commentCount).toBe(2)

  expect((await widnall.fetch(`/api/comments/${theirs.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await dishOn(yalow, board.id, dish.id)).commentCount).toBe(1)
})

test('a Dish on the Board carries its Votes for the tally', async () => {
  const { board, yalow, widnall } = await sharedBoard('Daumen zählen')
  const dish = await addDish(yalow, board.id)
  await cook(yalow, dish.id)
  await vote(yalow, dish.id, true)
  await vote(widnall, dish.id, false)
  const { votes } = await dishOn(widnall, board.id, dish.id)
  expect(votes.filter(v => v.up)).toHaveLength(1)
  expect(votes.filter(v => !v.up)).toHaveLength(1)
})

test('another Member\'s Comment marks the Dish for me until I open it; my own doesn\'t', async () => {
  const { board, yalow, widnall } = await sharedBoard('Neues im Verlauf')
  const dish = await addDish(yalow, board.id)
  await opened(yalow, dish.id)
  await opened(widnall, dish.id)
  expect(await isMarked(yalow, board.id, dish.id)).toBe(false)

  await comment(widnall, dish.id)
  expect(await isMarked(yalow, board.id, dish.id)).toBe(true)
  expect(await isMarked(widnall, board.id, dish.id)).toBe(false)

  await opened(yalow, dish.id)
  expect(await isMarked(yalow, board.id, dish.id)).toBe(false)
})

test('another Member\'s Cooking or Vote marks the Dish too', async () => {
  const { board, yalow, widnall } = await sharedBoard('Gekocht und bewertet')
  const dish = await addDish(yalow, board.id)
  await opened(yalow, dish.id)

  await cook(widnall, dish.id)
  expect(await isMarked(yalow, board.id, dish.id)).toBe(true)
  await opened(yalow, dish.id)

  await vote(widnall, dish.id, true)
  expect(await isMarked(yalow, board.id, dish.id)).toBe(true)
  await opened(yalow, dish.id)
  expect(await isMarked(yalow, board.id, dish.id)).toBe(false)
})

test('a Dish never opened is marked by what others added after I joined, not by its adding', async () => {
  const { board, yalow, widnall } = await sharedBoard('Nie geöffnet')
  const dish = await addDish(yalow, board.id)
  // Added by another Member, it is a New Dish ("Neu"), not new in its history.
  expect(await isMarked(widnall, board.id, dish.id)).toBe(false)

  await comment(yalow, dish.id)
  expect(await isMarked(widnall, board.id, dish.id)).toBe(true)
})

test('a Comment deleted again no longer marks the Dish', async () => {
  const { board, yalow, widnall } = await sharedBoard('Zurückgenommen')
  const dish = await addDish(yalow, board.id)
  await opened(yalow, dish.id)
  const theirs = await comment(widnall, dish.id)
  expect((await widnall.fetch(`/api/comments/${theirs.id}`, { method: 'DELETE' })).status).toBe(204)
  expect(await isMarked(yalow, board.id, dish.id)).toBe(false)
})

test('opening a Dish answers its Dish History', async () => {
  const { board, yalow, widnall } = await sharedBoard('Öffnen')
  const dish = await addDish(yalow, board.id)
  await comment(widnall, dish.id, 'Mit Feta!')
  const res = await openDish(yalow, dish.id)
  expect(res.status).toBe(200)
  const history = await res.json() as { dishId: string, entries: { kind: string }[] }
  expect(history.dishId).toBe(dish.id)
  expect(history.entries.map(e => e.kind)).toEqual(['added', 'comment'])
})

test('only a Member opens a Dish', async () => {
  const { board, yalow } = await sharedBoard('Nur Mitglieder')
  const dish = await addDish(yalow, board.id)
  expect((await openDish(await outsider(), dish.id)).status).toBe(404)
  expect((await openDish(yalow, '00000000-0000-4000-8000-000000000000')).status).toBe(404)
})
