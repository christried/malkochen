import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { OPERATOR } from '../support/test-auth-env'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { startPushService, type PushService } from './push-service'

// The Week Plan on a Board (#513, CONTEXT.md: Week Plan, Planned Dish; ADR
// 0014): POST /api/boards/:id/planned-dishes puts a Dish on a day,
// PATCH /api/planned-dishes/:id moves it, DELETE takes it off the plan. The
// whole plan travels with the Board load. [245] owns the Boards made here,
// [246] joins them, [247] is the outsider; all three are used by this file
// only. The Operator (babbage) is shared with other files.

const owner = () => signIn(ALLOWLISTED[245])
const member = () => signIn(ALLOWLISTED[246])
const outsider = () => signIn(ALLOWLISTED[247])
const operator = () => signIn(OPERATOR)

// Every test plans on days of its own, as the Boards are shared between them
// (a user can make 20 Boards a day): three days in a row, far from the others.
let testDays = new Set<string>()
let tests = 0
function freshDays(): [string, string, string] {
  const start = Date.UTC(2031, 0, 1) + tests++ * 3 * 24 * 60 * 60 * 1000
  const days = [0, 1, 2].map(i => new Date(start + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) as [string, string, string]
  testDays = new Set(days)
  return days
}
// The Planned Dishes on the test's days.
const onTestDays = (planned: Planned[]) => planned.filter(p => testDays.has(p.day))

interface Dish { id: string, title: string }
interface Planned { id: string, dishId: string, day: string }
interface Column { id: string, name: string, isGekocht: boolean, dishes: Dish[] }
interface Board {
  id: string
  inviteToken: string
  version: number
  plannedDishes: Planned[]
  newInHistoryDishIds: string[]
  members: { id: string, name: string }[]
  columns: Column[]
}

let pushService: PushService
beforeAll(async () => {
  pushService = await startPushService()
  // The first sign-in makes each account and its first Board.
  await Promise.all([owner(), member(), outsider(), operator()])
})
afterAll(() => pushService.close())
beforeEach(() => pushService.forget())

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, { method, ...body === undefined ? {} : json(body) })

const getBoard = (caller: Caller, id: string): Promise<Board> => caller.fetch(`/api/boards/${id}`).then(res => res.json())
const idOf = async (caller: Caller): Promise<string> => (await (await caller.fetch('/api/me')).json() as { id: string }).id
const versionOf = async (caller: Caller, boardId: string): Promise<number> =>
  (await (await caller.fetch(`/api/boards/${boardId}/version`)).json() as { version: number }).version

async function newBoard(caller: Caller, name: string): Promise<Board> {
  const res = await send(caller, 'POST', '/api/boards', { name, emoji: '🗓️' })
  expect(res.status).toBe(201)
  return getBoard(caller, (await res.json() as { id: string }).id)
}

// The Boards the tests share, made when first needed: one the member may do
// everything on, one where they may not move Dishes, and a second Board of the
// owner's that nothing is ever planned on.
const made = new Map<string, Promise<unknown>>()
function once<T>(key: string, make: () => Promise<T>): Promise<T> {
  if (!made.has(key)) made.set(key, make())
  return made.get(key) as Promise<T>
}
const plain = () => once('plain', () => sharedBoard('Wochenplan'))
const quiet = () => once('quiet', () => sharedBoard('Ohne Verschieben', { moveDishes: false }))
const targetBoard = async () => once('target', async () => newBoard(await owner(), 'Zielboard'))

// A new Board of the owner's that the member joined, everyone having opened
// it. `permissions` switches the member's Permissions.
async function sharedBoard(name: string, permissions: Record<string, boolean> = {}) {
  const [ada, grace] = await Promise.all([owner(), member()])
  const board = await newBoard(ada, name)
  expect((await send(grace, 'POST', `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  for (const caller of [ada, grace]) expect((await send(caller, 'POST', `/api/boards/${board.id}/open`)).status).toBe(204)
  if (Object.keys(permissions).length > 0) {
    expect((await send(ada, 'PATCH', `/api/boards/${board.id}/members/${await idOf(grace)}/permissions`, permissions)).status).toBe(200)
  }
  return { board, ada, grace }
}

async function addDish(caller: Caller, boardId: string, title: string): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

// POST /api/boards/:id/planned-dishes, answered as is.
const planRaw = (caller: Caller, boardId: string, body: Record<string, unknown>) =>
  send(caller, 'POST', `/api/boards/${boardId}/planned-dishes`, body)
const moveRaw = (caller: Caller, id: string, body: unknown) => send(caller, 'PATCH', `/api/planned-dishes/${id}`, body)
const unplanRaw = (caller: Caller, id: string) => send(caller, 'DELETE', `/api/planned-dishes/${id}`)

// Plans the Dish and expects it to work.
async function plan(caller: Caller, boardId: string, dish: Dish, day: string, index?: number): Promise<Planned> {
  const res = await planRaw(caller, boardId, { id: randomUUID(), dishId: dish.id, day, index })
  expect(res.status, await res.clone().text()).toBe(201)
  return res.json()
}

async function move(caller: Caller, planned: Planned, day: string, index?: number): Promise<Planned> {
  const res = await moveRaw(caller, planned.id, { day, index })
  expect(res.status, await res.clone().text()).toBe(200)
  return res.json()
}

// The Board's Week Plan as the Board load carries it: [day, Planned Dish id]
// in order.
async function planOf(caller: Caller, boardId: string): Promise<string[][]> {
  return onTestDays((await getBoard(caller, boardId)).plannedDishes).map(p => [p.day, p.id])
}

// The Planned Dish ids of one day, in order.
async function dayOf(caller: Caller, boardId: string, day: string): Promise<string[]> {
  return (await getBoard(caller, boardId)).plannedDishes.filter(p => p.day === day).map(p => p.id)
}

test('a Dish planned on a day is read back by every Member, with the plan from past weeks too', async () => {
  const [, , WEDNESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const gnocchi = await addDish(ada, board.id, 'Gnocchi')
  const id = randomUUID()

  const res = await planRaw(grace, board.id, { id, dishId: ramen.id, day: WEDNESDAY })

  expect(res.status).toBe(201)
  expect(await res.json()).toEqual({ id, dishId: ramen.id, day: WEDNESDAY })
  testDays.add('2020-01-06')
  await plan(ada, board.id, gnocchi, '2020-01-06')
  for (const caller of [ada, grace]) {
    expect(onTestDays((await getBoard(caller, board.id)).plannedDishes)).toEqual([
      { id: expect.any(String), dishId: gnocchi.id, day: '2020-01-06' },
      { id, dishId: ramen.id, day: WEDNESDAY },
    ])
  }
})

test('a Board without a plan carries an empty one', async () => {
  const { id } = await targetBoard()
  const ada = await owner()
  await addDish(ada, id, 'Ramen')

  expect((await getBoard(ada, id)).plannedDishes).toEqual([])
})

test('a Dish can be planned on several days, and twice on one day', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')

  const monday = await plan(ada, board.id, ramen, MONDAY)
  const tuesday = await plan(ada, board.id, ramen, TUESDAY)
  const tuesdayAgain = await plan(ada, board.id, ramen, TUESDAY)

  expect(new Set([monday.id, tuesday.id, tuesdayAgain.id]).size).toBe(3)
  expect(await planOf(ada, board.id)).toEqual([[MONDAY, monday.id], [TUESDAY, tuesday.id], [TUESDAY, tuesdayAgain.id]])
})

test('the plan is in the order of the days, whatever order they were planned in', async () => {
  const [MONDAY, , WEDNESDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const late = await plan(ada, board.id, ramen, WEDNESDAY)
  const early = await plan(ada, board.id, ramen, MONDAY)

  expect(await planOf(ada, board.id)).toEqual([[MONDAY, early.id], [WEDNESDAY, late.id]])
})

test('several Dishes on one day are in the order the index gave; without one a Dish goes to the end', async () => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const [a, b, c, d] = await Promise.all(['A', 'B', 'C', 'D'].map(t => addDish(ada, board.id, t)))

  const first = await plan(ada, board.id, a!, MONDAY)
  const second = await plan(ada, board.id, b!, MONDAY)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([first.id, second.id])

  const top = await plan(ada, board.id, c!, MONDAY, 0)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([top.id, first.id, second.id])

  const between = await plan(ada, board.id, d!, MONDAY, 2)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([top.id, first.id, between.id, second.id])
})

test('an index past the end puts the Dish at the end', async () => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const [a, b, c] = await Promise.all(['A', 'B', 'C'].map(t => addDish(ada, board.id, t)))
  const first = await plan(ada, board.id, a!, MONDAY)
  const second = await plan(ada, board.id, b!, MONDAY)

  const last = await plan(ada, board.id, c!, MONDAY, 50)

  expect(await dayOf(ada, board.id, MONDAY)).toEqual([first.id, second.id, last.id])
  // A later one at the end really is after it.
  const after = await plan(ada, board.id, a!, MONDAY)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([first.id, second.id, last.id, after.id])
})

test('an index counts among the day\'s own Dishes, not the other days\'', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada } = await plain()
  const [a, b] = await Promise.all(['A', 'B'].map(t => addDish(ada, board.id, t)))
  const monday = await plan(ada, board.id, a!, MONDAY)

  const tuesday = await plan(ada, board.id, b!, TUESDAY, 0)

  expect(await dayOf(ada, board.id, MONDAY)).toEqual([monday.id])
  expect(await dayOf(ada, board.id, TUESDAY)).toEqual([tuesday.id])
})

test('a Planned Dish moves to another day, at an index or at the end', async () => {
  const [MONDAY, TUESDAY, WEDNESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const [a, b, c] = await Promise.all(['A', 'B', 'C'].map(t => addDish(ada, board.id, t)))
  const onMonday = await plan(ada, board.id, a!, MONDAY)
  const onTuesday = await plan(ada, board.id, b!, TUESDAY)
  const other = await plan(ada, board.id, c!, TUESDAY)

  const atIndex = await move(grace, onMonday, TUESDAY, 1)
  expect(atIndex).toEqual({ id: onMonday.id, dishId: a!.id, day: TUESDAY })
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([])
  expect(await dayOf(ada, board.id, TUESDAY)).toEqual([onTuesday.id, onMonday.id, other.id])

  await move(grace, onTuesday, WEDNESDAY)
  expect(await dayOf(ada, board.id, WEDNESDAY)).toEqual([onTuesday.id])
  const second = await plan(ada, board.id, a!, WEDNESDAY)
  await move(grace, second, TUESDAY, 0)
  await move(grace, onMonday, WEDNESDAY)
  expect(await dayOf(ada, board.id, WEDNESDAY)).toEqual([onTuesday.id, onMonday.id])
})

test('a Planned Dish moved with an index within its day reorders the day', async () => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const [a, b, c] = await Promise.all(['A', 'B', 'C'].map(t => addDish(ada, board.id, t)))
  const first = await plan(ada, board.id, a!, MONDAY)
  const second = await plan(ada, board.id, b!, MONDAY)
  const third = await plan(ada, board.id, c!, MONDAY)

  await move(ada, third, MONDAY, 0)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([third.id, first.id, second.id])

  await move(ada, third, MONDAY, 1)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([first.id, third.id, second.id])

  await move(ada, first, MONDAY, 9)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([third.id, second.id, first.id])

  // Without an index it goes to the end of its day.
  await move(ada, third, MONDAY)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([second.id, first.id, third.id])
})

test('a Planned Dish taken off the plan leaves the Dish on the Board', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const other = await plan(ada, board.id, ramen, TUESDAY)

  const res = await unplanRaw(grace, planned.id)

  expect(res.status).toBe(204)
  const after = await getBoard(ada, board.id)
  expect(onTestDays(after.plannedDishes).map(p => p.id)).toEqual([other.id])
  expect(after.columns.flatMap(c => c.dishes.map(d => d.id))).toContain(ramen.id)
  // Gone: it can be neither moved nor taken off again.
  expect((await moveRaw(ada, planned.id, { day: TUESDAY })).status).toBe(404)
  expect((await unplanRaw(ada, planned.id)).status).toBe(404)
})

test('planning, moving and unplanning leave the Dish in its Column', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const columnOf = async () => (await getBoard(ada, board.id)).columns.find(c => c.dishes.some(d => d.id === ramen.id))!.id
  const before = await columnOf()
  const gekocht = board.columns.find(c => c.isGekocht)!.id
  expect(before).not.toBe(gekocht)

  const planned = await plan(ada, board.id, ramen, MONDAY)
  await move(ada, planned, TUESDAY)
  expect(await columnOf()).toBe(before)
  expect((await unplanRaw(ada, planned.id)).status).toBe(204)
  expect(await columnOf()).toBe(before)

  // And moving the Dish between Columns neither plans nor unplans it.
  const kept = await plan(ada, board.id, ramen, MONDAY)
  expect((await send(ada, 'POST', `/api/dishes/${ramen.id}/move`, { columnId: board.columns[1]!.id })).status).toBe(200)
  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes).map(p => p.id)).toEqual([kept.id])
})

test('without "move Dishes" a Member can\'t plan, move or unplan, a Dish they added themselves neither', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await quiet()
  const theirs = await addDish(ada, board.id, 'Ramen')
  const own = await addDish(grace, board.id, 'Gnocchi')
  const planned = await plan(ada, board.id, theirs, MONDAY)
  const before = await getBoard(ada, board.id)

  for (const dish of [theirs, own]) {
    const res = await planRaw(grace, board.id, { id: randomUUID(), dishId: dish.id, day: MONDAY })
    expect(res.status).toBe(403)
    expect((await res.json()).data).toEqual({ permission: 'moveDishes' })
  }
  expect((await moveRaw(grace, planned.id, { day: TUESDAY })).status).toBe(403)
  expect((await unplanRaw(grace, planned.id)).status).toBe(403)

  // They still read the plan.
  expect((await getBoard(grace, board.id)).plannedDishes).toEqual(before.plannedDishes)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([planned.id])
})

test('with "move Dishes" a Member plans anyone\'s Dish; the Owner always may', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const theirs = await addDish(ada, board.id, 'Ramen')
  const own = await addDish(grace, board.id, 'Gnocchi')

  const fromGrace = await plan(grace, board.id, theirs, MONDAY)
  const fromAda = await plan(ada, board.id, own, MONDAY)

  expect(await dayOf(ada, board.id, MONDAY)).toEqual([fromGrace.id, fromAda.id])
  await move(ada, fromGrace, TUESDAY)
  expect((await unplanRaw(grace, fromAda.id)).status).toBe(204)
})

test('the Operator plans, moves and unplans on a Board they aren\'t a Member of, and sees its plan', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const babbage = await operator()

  const planned = await plan(babbage, board.id, ramen, MONDAY)
  await move(babbage, planned, TUESDAY)

  expect(onTestDays((await getBoard(babbage, board.id)).plannedDishes)).toEqual([{ id: planned.id, dishId: ramen.id, day: TUESDAY }])
  expect((await unplanRaw(babbage, planned.id)).status).toBe(204)
  expect(await planOf(ada, board.id)).toEqual([])
})

test('someone who isn\'t a Member gets "not found" for all three, and changes nothing', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const stranger = await outsider()

  expect((await planRaw(stranger, board.id, { id: randomUUID(), dishId: ramen.id, day: MONDAY })).status).toBe(404)
  expect((await moveRaw(stranger, planned.id, { day: TUESDAY })).status).toBe(404)
  expect((await unplanRaw(stranger, planned.id)).status).toBe(404)
  expect(await planOf(ada, board.id)).toEqual([[MONDAY, planned.id]])
})

test('a Dish that is archived, missing or on another Board can\'t be planned', async () => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const elsewhere = await targetBoard()
  const archived = await addDish(ada, board.id, 'Archiviert')
  const foreign = await addDish(ada, elsewhere.id, 'Woanders')
  expect((await send(ada, 'DELETE', `/api/dishes/${archived.id}`)).status).toBe(204)

  for (const dishId of [archived.id, foreign.id, randomUUID()]) {
    const res = await planRaw(ada, board.id, { id: randomUUID(), dishId, day: MONDAY })
    expect(res.status).toBe(404)
  }
  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes)).toEqual([])
  expect((await getBoard(ada, elsewhere.id)).plannedDishes).toEqual([])
})

test('archiving a Dish hides its Planned Dishes, restoring brings them back where they were', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const [a, b] = await Promise.all(['A', 'B'].map(t => addDish(ada, board.id, t)))
  const first = await plan(ada, board.id, a!, MONDAY)
  const middle = await plan(ada, board.id, b!, MONDAY)
  const last = await plan(ada, board.id, a!, MONDAY)

  expect((await send(ada, 'DELETE', `/api/dishes/${b!.id}`)).status).toBe(204)

  expect(await dayOf(grace, board.id, MONDAY)).toEqual([first.id, last.id])
  // Hidden: it can't be moved or unplanned meanwhile.
  expect((await moveRaw(ada, middle.id, { day: TUESDAY })).status).toBe(404)
  expect((await unplanRaw(ada, middle.id)).status).toBe(404)
  // A new one at the end is after the others, hidden or not.
  const newest = await plan(ada, board.id, a!, MONDAY)

  expect((await send(ada, 'POST', `/api/dishes/${b!.id}/restore`)).status).toBe(200)

  expect(await dayOf(grace, board.id, MONDAY)).toEqual([first.id, middle.id, last.id, newest.id])
})

test('deleting an Archived Dish for good takes its Planned Dishes with it', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const kept = await addDish(ada, board.id, 'Gnocchi')
  const gone = await plan(ada, board.id, ramen, MONDAY)
  const stays = await plan(ada, board.id, kept, MONDAY)
  expect((await send(ada, 'DELETE', `/api/dishes/${ramen.id}`)).status).toBe(204)

  expect((await send(ada, 'POST', `/api/dishes/${ramen.id}/purge`)).status).toBe(204)

  expect(await planOf(ada, board.id)).toEqual([[MONDAY, stays.id]])
  expect((await moveRaw(ada, gone.id, { day: TUESDAY })).status).toBe(404)
  expect((await unplanRaw(ada, gone.id)).status).toBe(404)
})

test('a Dish moved to another Board leaves the Week Plan, and doesn\'t come back with it', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada } = await plain()
  const target = await targetBoard()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const stays = await addDish(ada, board.id, 'Gnocchi')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const kept = await plan(ada, board.id, stays, MONDAY)

  const res = await send(ada, 'POST', `/api/dishes/${ramen.id}/move`, { columnId: target.columns[0]!.id })
  expect(res.status).toBe(200)

  expect(await planOf(ada, board.id)).toEqual([[MONDAY, kept.id]])
  expect((await getBoard(ada, target.id)).plannedDishes).toEqual([])
  expect((await moveRaw(ada, planned.id, { day: TUESDAY })).status).toBe(404)
  // Back on the first Board it is not planned any more.
  expect((await send(ada, 'POST', `/api/dishes/${ramen.id}/move`, { columnId: board.columns[0]!.id })).status).toBe(200)
  expect(await planOf(ada, board.id)).toEqual([[MONDAY, kept.id]])
})

test('moving Dishes to another Board in bulk takes them off the plan too', async () => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const target = await targetBoard()
  const ramen = await addDish(ada, board.id, 'Ramen')
  await plan(ada, board.id, ramen, MONDAY)

  const res = await send(ada, 'POST', '/api/dishes/bulk', { action: 'move', dishIds: [ramen.id], columnId: target.columns[0]!.id })
  expect(res.status, await res.clone().text()).toBe(200)

  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes)).toEqual([])
})

test('a Copy of a planned Dish is not planned', async () => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const target = await targetBoard()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)

  const res = await send(ada, 'POST', `/api/dishes/${ramen.id}/copy`, { boardId: target.id })
  expect(res.status).toBe(201)

  expect((await getBoard(ada, target.id)).plannedDishes).toEqual([])
  expect(await planOf(ada, board.id)).toEqual([[MONDAY, planned.id]])
})

test('each write moves the Board Version', async () => {
  const [MONDAY, TUESDAY, WEDNESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const other = await addDish(ada, board.id, 'Gnocchi')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  await plan(ada, board.id, other, TUESDAY)

  let seen = await versionOf(grace, board.id)
  const moves = async (write: () => Promise<Response>, status: number) => {
    const res = await write()
    expect(res.status, await res.clone().text()).toBe(status)
    const now = await versionOf(grace, board.id)
    expect(now).toBeGreaterThan(seen)
    expect((await getBoard(grace, board.id)).version).toBe(now)
    seen = now
  }

  await moves(() => planRaw(ada, board.id, { id: randomUUID(), dishId: ramen.id, day: WEDNESDAY, index: 0 }), 201)
  await moves(() => moveRaw(ada, planned.id, { day: TUESDAY, index: 0 }), 200)
  await moves(() => unplanRaw(ada, planned.id), 204)
})

test('a refused write leaves the Board Version where it is', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await quiet()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const before = await versionOf(grace, board.id)

  expect((await planRaw(grace, board.id, { id: randomUUID(), dishId: ramen.id, day: TUESDAY })).status).toBe(403)
  expect((await moveRaw(grace, planned.id, { day: TUESDAY })).status).toBe(403)
  expect((await planRaw(ada, board.id, { id: randomUUID(), dishId: randomUUID(), day: TUESDAY })).status).toBe(404)

  expect(await versionOf(grace, board.id)).toBe(before)
})

test('each write is in the Event Log with its details, and a move is one event however many Planned Dishes it shifted', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const [a, b, c] = await Promise.all(['A', 'B', 'C'].map(t => addDish(ada, board.id, t)))
  const adaId = await idOf(ada)
  const graceId = await idOf(grace)
  const watch = await watchEvents()

  const first = await plan(ada, board.id, a!, MONDAY)
  await plan(ada, board.id, b!, MONDAY)
  const third = await plan(grace, board.id, c!, TUESDAY)
  await move(grace, third, MONDAY, 0)
  expect((await unplanRaw(ada, first.id)).status).toBe(204)

  expect(await watch.recorded()).toEqual([
    { kind: 'dish_planned', boardId: board.id, dishId: a!.id, userId: adaId, details: { plannedDish: first.id, day: MONDAY } },
    { kind: 'dish_planned', boardId: board.id, dishId: b!.id, userId: adaId, details: { plannedDish: expect.any(String), day: MONDAY } },
    { kind: 'dish_planned', boardId: board.id, dishId: c!.id, userId: graceId, details: { plannedDish: third.id, day: TUESDAY } },
    { kind: 'planned_dish_moved', boardId: board.id, dishId: c!.id, userId: graceId, details: { plannedDish: third.id, from: TUESDAY, to: MONDAY } },
    { kind: 'dish_unplanned', boardId: board.id, dishId: a!.id, userId: adaId, details: { plannedDish: first.id } },
  ])
})

test('a refused write records no event', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await quiet()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const watch = await watchEvents()

  await planRaw(grace, board.id, { id: randomUUID(), dishId: ramen.id, day: TUESDAY })
  await moveRaw(grace, planned.id, { day: TUESDAY })
  await unplanRaw(grace, planned.id)
  await planRaw(ada, board.id, { id: randomUUID(), dishId: randomUUID(), day: TUESDAY })
  await planRaw(ada, board.id, { id: planned.id, dishId: ramen.id, day: TUESDAY })

  expect(await watch.recorded()).toEqual([])
})

test('planning adds nothing to "Neues im Verlauf" and sends no Push Notification', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const device = pushService.device('grace-week-plan')
  expect((await send(grace, 'PUT', '/api/me/push', device.subscription)).status).toBe(204)
  try {
    const ramen = await addDish(ada, board.id, 'Ramen')
    // The stand-in does reach Grace for what is notified.
    expect(pushService.deliveries.map(d => d.device)).toEqual(['grace-week-plan'])
    // Nothing is new to her once she opened the Dish.
    expect((await send(grace, 'POST', `/api/dishes/${ramen.id}/open`)).status).toBe(200)
    expect((await getBoard(grace, board.id)).newInHistoryDishIds).toEqual([])
    pushService.forget()

    const planned = await plan(ada, board.id, ramen, MONDAY)
    await move(ada, planned, TUESDAY, 0)
    expect((await unplanRaw(ada, planned.id)).status).toBe(204)

    expect((await getBoard(grace, board.id)).newInHistoryDishIds).toEqual([])
    expect(pushService.deliveries).toEqual([])
  }
  finally {
    await send(grace, 'DELETE', '/api/me/push', { endpoint: device.subscription.endpoint })
  }
})

test('the same id planned twice is refused with 409 and plans nothing more', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const [a, b] = await Promise.all(['A', 'B'].map(t => addDish(ada, board.id, t)))
  const id = randomUUID()
  expect((await planRaw(ada, board.id, { id, dishId: a!.id, day: MONDAY })).status).toBe(201)

  expect((await planRaw(ada, board.id, { id, dishId: a!.id, day: MONDAY })).status).toBe(409)
  expect((await planRaw(grace, board.id, { id, dishId: b!.id, day: TUESDAY })).status).toBe(409)

  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes)).toEqual([{ id, dishId: a!.id, day: MONDAY }])
})

test.each([
  ['no day', { dishId: 'dish' }],
  ['a day that isn\'t a date', { dishId: 'dish', day: 'tomorrow' }],
  ['a date that doesn\'t exist', { dishId: 'dish', day: '2026-02-30' }],
  ['a date with a time', { dishId: 'dish', day: '2026-11-16T12:00:00Z' }],
  ['a day that isn\'t text', { dishId: 'dish', day: 20261116 }],
  ['a negative index', { dishId: 'dish', day: '2026-11-16', index: -1 }],
  ['an index that isn\'t whole', { dishId: 'dish', day: '2026-11-16', index: 1.5 }],
  ['an index that is too large', { dishId: 'dish', day: '2026-11-16', index: 100_001 }],
  ['an index that isn\'t a number', { dishId: 'dish', day: '2026-11-16', index: 'first' }],
  ['no Dish', { day: '2026-11-16' }],
  ['a Dish id that isn\'t one', { dishId: 'ramen', day: '2026-11-16' }],
  ['an id that isn\'t one', { dishId: 'dish', day: '2026-11-16', id: 'mine' }],
])('planning with %s is a bad request', async (_, body: Record<string, unknown>) => {
  freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const filled = { id: randomUUID(), ...body, dishId: body.dishId === 'dish' ? ramen.id : body.dishId }

  expect((await planRaw(ada, board.id, filled)).status).toBe(400)
  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes)).toEqual([])
})

test('planning with no body, or without an id, is a bad request', async () => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')

  expect((await send(ada, 'POST', `/api/boards/${board.id}/planned-dishes`)).status).toBe(400)
  expect((await planRaw(ada, board.id, { dishId: ramen.id, day: MONDAY })).status).toBe(400)
})

test.each([
  ['no day', {}],
  ['a day that isn\'t a date', { day: 'monday' }],
  ['a date that doesn\'t exist', { day: '2026-13-01' }],
  ['a negative index', { day: '2026-11-17', index: -1 }],
  ['an index that isn\'t whole', { day: '2026-11-17', index: 0.5 }],
  ['an index that is too large', { day: '2026-11-17', index: 100_001 }],
])('moving with %s is a bad request', async (_, body) => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)

  expect((await moveRaw(ada, planned.id, body)).status).toBe(400)
  expect(await planOf(ada, board.id)).toEqual([[MONDAY, planned.id]])
})

test('a Planned Dish that doesn\'t exist is "not found" to move or unplan', async () => {
  const [MONDAY] = freshDays()
  for (const id of [randomUUID(), 'not-a-planned-dish']) {
    const ada = await owner()
    expect((await moveRaw(ada, id, { day: MONDAY })).status).toBe(404)
    expect((await unplanRaw(ada, id)).status).toBe(404)
  }
})
