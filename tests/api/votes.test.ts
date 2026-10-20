import { expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { watchEvents } from './event-log'

// Votes (#334; PRD #318 stories 14–19): once a Dish is Cooked, every Member
// gives it a thumbs up or down, one each, and changes or takes it back. A
// Vote stays when the Dish moves out of the Gekocht Column, and shows in the
// Dish History as the Member's current Vote, at the time it was last set.
// Cori owns the Boards made here, Mitchell joins them, Herschel is the
// outsider; all three are used by this file only.

interface Person { id: string, name: string, image: string | null }
interface Vote { voter: Person, up: boolean, votedAt: string }
interface Cooking { id: string, cookedAt: string }
type Entry =
  | { kind: 'added', at: string }
  | { kind: 'cooking', at: string, cooking: Cooking }
  | { kind: 'comment', at: string }
  | { kind: 'vote', at: string, vote: Vote }
interface Dish { id: string, votes: Vote[], cooking?: Cooking }
interface Column { id: string, isGekocht: boolean, dishes: Dish[] }
interface Board { id: string, inviteToken: string, columns: Column[] }

const owner = () => signIn(ALLOWLISTED[91])
const member = () => signIn(ALLOWLISTED[92])
const outsider = () => signIn(ALLOWLISTED[93])
const MISSING = '00000000-0000-4000-8000-000000000000'

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) =>
  caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })

const vote = (caller: Caller, dishId: string, up: unknown) => caller.fetch(`/api/dishes/${dishId}/vote`, { method: 'PUT', ...json({ up }) })
const takeBack = (caller: Caller, dishId: string) => caller.fetch(`/api/dishes/${dishId}/vote`, { method: 'DELETE' })

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

// A new Board of the owner's that the member has joined.
async function sharedBoard(name: string): Promise<{ board: Board, cori: Caller, mitchell: Caller }> {
  const cori = await owner()
  const res = await post(cori, '/api/boards', { name, emoji: '🥘' })
  expect(res.status).toBe(201)
  const board = await getBoard(cori, (await res.json() as { id: string }).id)
  const mitchell = await member()
  expect((await post(mitchell, `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  return { board, cori, mitchell }
}

async function addDish(caller: Caller, boardId: string, title = 'Shakshuka'): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

// A new Dish, Cooked once by `caller`.
async function cookedDish(caller: Caller, boardId: string): Promise<Dish> {
  const dish = await addDish(caller, boardId)
  const res = await post(caller, `/api/dishes/${dish.id}/cook`)
  expect(res.status).toBe(200)
  return res.json()
}

async function voted(caller: Caller, dishId: string, up: boolean): Promise<Vote> {
  const res = await vote(caller, dishId, up)
  expect(res.status).toBe(200)
  return res.json()
}

// The Dish's Votes as its Board shows them.
async function votesOn(caller: Caller, boardId: string, dishId: string): Promise<Vote[]> {
  const board = await getBoard(caller, boardId)
  return board.columns.flatMap(c => c.dishes).find(d => d.id === dishId)!.votes
}

async function historyVotes(caller: Caller, dishId: string): Promise<Vote[]> {
  const res = await caller.fetch(`/api/dishes/${dishId}/history`)
  expect(res.status).toBe(200)
  const { entries } = await res.json() as { entries: Entry[] }
  return entries.flatMap(e => e.kind === 'vote' ? [e.vote] : [])
}

test('any Member votes on a Cooked Dish, also one who didn\'t record the Cooking', async () => {
  const { board, cori, mitchell } = await sharedBoard('Abstimmen')
  const dish = await cookedDish(cori, board.id)
  const before = Date.now()

  const mine = await voted(mitchell, dish.id, true)

  expect(mine).toMatchObject({ up: true, voter: { id: await idOf(mitchell), name: expect.any(String) } })
  expect(Date.parse(mine.votedAt)).toBeGreaterThanOrEqual(before - 5000)
  const owners = await voted(cori, dish.id, false)
  expect(await votesOn(cori, board.id, dish.id)).toEqual([mine, owners])
})

test('a Dish that was never Cooked takes no Vote, nor one whose only Cooking was deleted', async () => {
  const { board, cori } = await sharedBoard('Nie gekocht')
  const fresh = await addDish(cori, board.id)
  const uncooked = await cookedDish(cori, board.id)
  expect((await cori.fetch(`/api/cookings/${uncooked.cooking!.id}`, { method: 'DELETE' })).status).toBe(204)

  expect((await vote(cori, fresh.id, true)).status).toBe(409)
  expect((await vote(cori, uncooked.id, true)).status).toBe(409)
  expect(await votesOn(cori, board.id, fresh.id)).toEqual([])
})

test('one Vote per Member: voting again changes it, at the time it was changed', async () => {
  const { board, cori, mitchell } = await sharedBoard('Umentscheiden')
  const dish = await cookedDish(cori, board.id)
  const first = await voted(mitchell, dish.id, true)

  const changed = await voted(mitchell, dish.id, false)

  expect(changed).toMatchObject({ up: false, voter: first.voter })
  expect(Date.parse(changed.votedAt)).toBeGreaterThanOrEqual(Date.parse(first.votedAt))
  expect(await votesOn(cori, board.id, dish.id)).toEqual([changed])
})

test('a Member takes their Vote back; taking back none changes nothing', async () => {
  const { board, cori, mitchell } = await sharedBoard('Zurücknehmen')
  const dish = await cookedDish(cori, board.id)
  const owners = await voted(cori, dish.id, true)
  await voted(mitchell, dish.id, false)

  expect((await takeBack(mitchell, dish.id)).status).toBe(204)
  expect(await votesOn(cori, board.id, dish.id)).toEqual([owners])
  expect((await takeBack(mitchell, dish.id)).status).toBe(204)
})

test('a Vote stays when the Dish moves out of the Gekocht Column', async () => {
  const { board, cori } = await sharedBoard('Weiter')
  const dish = await cookedDish(cori, board.id)
  const mine = await voted(cori, dish.id, true)

  expect((await post(cori, `/api/dishes/${dish.id}/move`, { columnId: board.columns[0]!.id })).status).toBe(200)

  expect(await votesOn(cori, board.id, dish.id)).toEqual([mine])
  // And it can still be changed there.
  expect((await voted(cori, dish.id, false)).up).toBe(false)
})

test('nobody votes on a Dish of a Board they are not a Member of, a missing or an Archived Dish', async () => {
  const { board, cori } = await sharedBoard('Fremd')
  const dish = await cookedDish(cori, board.id)
  const archived = await cookedDish(cori, board.id)
  expect((await cori.fetch(`/api/dishes/${archived.id}`, { method: 'DELETE' })).status).toBe(204)
  const stranger = await outsider()

  expect((await vote(stranger, dish.id, true)).status).toBe(404)
  expect((await takeBack(stranger, dish.id)).status).toBe(404)
  expect((await vote(cori, MISSING, true)).status).toBe(404)
  expect((await vote(cori, 'not-a-uuid', true)).status).toBe(404)
  expect((await vote(cori, archived.id, true)).status).toBe(404)
  expect((await takeBack(cori, archived.id)).status).toBe(404)
})

test.each([
  ['missing', undefined],
  ['not a boolean', 'up'],
])('a Vote that is %s is refused', async (_, up) => {
  const { board, cori } = await sharedBoard('Kaputt')
  const dish = await cookedDish(cori, board.id)

  expect((await vote(cori, dish.id, up)).status).toBe(400)
})

test('an Archived Dish keeps its Votes, and brings them back when restored', async () => {
  const { board, cori } = await sharedBoard('Archiv')
  const dish = await cookedDish(cori, board.id)
  const mine = await voted(cori, dish.id, true)
  expect((await cori.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await post(cori, `/api/dishes/${dish.id}/restore`)).status).toBe(200)

  expect(await votesOn(cori, board.id, dish.id)).toEqual([mine])
})

test('the Dish History shows each Member\'s current Vote, at the time it was last set, after the Cooking', async () => {
  const { board, cori, mitchell } = await sharedBoard('Verlauf')
  const dish = await cookedDish(cori, board.id)
  await voted(cori, dish.id, false)
  const members = await voted(mitchell, dish.id, true)
  const owners = await voted(cori, dish.id, true)

  const res = await mitchell.fetch(`/api/dishes/${dish.id}/history`)
  const { entries } = await res.json() as { entries: Entry[] }
  expect(entries.map(e => e.kind)).toEqual(['added', 'cooking', 'vote', 'vote'])
  expect(entries.slice(2)).toEqual([
    { kind: 'vote', at: members.votedAt, vote: members },
    { kind: 'vote', at: owners.votedAt, vote: owners },
  ])
  expect((await takeBack(cori, dish.id)).status).toBe(204)
  expect(await historyVotes(mitchell, dish.id)).toEqual([members])
})

test('a Vote set, changed and taken back records each; what changes nothing or is refused records nothing', async () => {
  const { board, cori, mitchell } = await sharedBoard('Protokoll')
  const fresh = await addDish(cori, board.id)
  const dish = await cookedDish(cori, board.id)
  const log = await watchEvents()

  await voted(mitchell, dish.id, true)
  // The same Vote again changes nothing.
  await voted(mitchell, dish.id, true)
  await voted(mitchell, dish.id, false)
  expect((await takeBack(mitchell, dish.id)).status).toBe(204)
  expect((await takeBack(mitchell, dish.id)).status).toBe(204)
  expect((await vote(mitchell, fresh.id, true)).status).toBe(409)
  expect((await vote(await outsider(), dish.id, true)).status).toBe(404)

  const userId = await idOf(mitchell)
  const event = (kind: string, up: boolean) => ({ kind, boardId: board.id, dishId: dish.id, userId, details: { up } })
  expect(await log.recorded()).toEqual([
    event('vote_set', true),
    event('vote_changed', false),
    event('vote_taken_back', false),
  ])
})
