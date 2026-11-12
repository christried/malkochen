import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { OPERATOR } from '../support/test-auth-env'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { startResendService, type ResendService } from '../support/resend-service'
import { startPushService, type PushService } from './push-service'

// The Week Plan on a Board (#513, CONTEXT.md: Week Plan, Planned Dish; ADR
// 0014): POST /api/boards/:id/planned-dishes puts a Dish on a day,
// PATCH /api/planned-dishes/:id moves it, DELETE takes it off the plan. The
// whole plan travels with the Board load. [245] owns the Boards made here,
// [246] joins them, [247] is the outsider; all three are used by this file
// only; so are [248], who cooks and leaves, is removed or has a Board's
// archive, and [249], who deletes their account. The Operator (babbage) is
// shared with other files.
//
// Who cooks a Planned Dish (#514): PUT /api/planned-dishes/:id/cook. The cook
// is a Member of the Board, and is cleared when they leave, are removed or
// delete their account.

const owner = () => signIn(ALLOWLISTED[245])
const member = () => signIn(ALLOWLISTED[246])
const outsider = () => signIn(ALLOWLISTED[247])
const operator = () => signIn(OPERATOR)
const leaver = () => signIn(ALLOWLISTED[248])
const deleter = () => signIn(ALLOWLISTED[249])

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
interface Planned { id: string, dishId: string, day: string, cookId: string | null }
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
let resend: ResendService
beforeAll(async () => {
  pushService = await startPushService()
  resend = await startResendService()
  // The first sign-in makes each account and its first Board.
  await Promise.all([owner(), member(), outsider(), operator(), leaver(), deleter()])
})
afterAll(async () => {
  await pushService.close()
  await resend.close()
})
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
const cookRaw = (caller: Caller, id: string, cookId: unknown) => send(caller, 'PUT', `/api/planned-dishes/${id}/cook`, { cookId })

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
  expect(await res.json()).toEqual({ id, dishId: ramen.id, day: WEDNESDAY, cookId: null })
  testDays.add('2020-01-06')
  await plan(ada, board.id, gnocchi, '2020-01-06')
  for (const caller of [ada, grace]) {
    expect(onTestDays((await getBoard(caller, board.id)).plannedDishes)).toEqual([
      { id: expect.any(String), dishId: gnocchi.id, day: '2020-01-06', cookId: null },
      { id, dishId: ramen.id, day: WEDNESDAY, cookId: null },
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
  expect(atIndex).toEqual({ id: onMonday.id, dishId: a!.id, day: TUESDAY, cookId: null })
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

  expect(onTestDays((await getBoard(babbage, board.id)).plannedDishes)).toEqual([{ id: planned.id, dishId: ramen.id, day: TUESDAY, cookId: null }])
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

test('an id another user\'s or another Dish\'s Planned Dish has is refused with 409 and plans nothing more', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const [a, b] = await Promise.all(['A', 'B'].map(t => addDish(ada, board.id, t)))
  const id = randomUUID()
  expect((await planRaw(ada, board.id, { id, dishId: a!.id, day: MONDAY })).status).toBe(201)

  expect((await planRaw(ada, board.id, { id, dishId: b!.id, day: MONDAY })).status).toBe(409)
  expect((await planRaw(grace, board.id, { id, dishId: a!.id, day: TUESDAY })).status).toBe(409)
  expect((await planRaw(grace, board.id, { id, dishId: b!.id, day: TUESDAY })).status).toBe(409)

  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes)).toEqual([{ id, dishId: a!.id, day: MONDAY, cookId: null }])
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

test('a Member is set as the cook of a Planned Dish and cleared again; every Member reads it, and by default nobody cooks', async () => {
  const [MONDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const graceId = await idOf(grace)
  expect(planned.cookId).toBeNull()

  const set = await cookRaw(ada, planned.id, graceId)

  expect(set.status).toBe(200)
  expect(await set.json()).toEqual({ id: planned.id, dishId: ramen.id, day: MONDAY, cookId: graceId })
  for (const caller of [ada, grace]) {
    expect(onTestDays((await getBoard(caller, board.id)).plannedDishes)).toEqual([{ id: planned.id, dishId: ramen.id, day: MONDAY, cookId: graceId }])
  }

  const cleared = await cookRaw(grace, planned.id, null)

  expect(cleared.status).toBe(200)
  expect(await cleared.json()).toEqual({ id: planned.id, dishId: ramen.id, day: MONDAY, cookId: null })
  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes)[0]!.cookId).toBeNull()
})

// A new Board of the owner's that these joined through its Invite Link.
async function boardWith(name: string, ...joiners: Caller[]) {
  const ada = await owner()
  const board = await newBoard(ada, name)
  for (const joiner of joiners) expect((await send(joiner, 'POST', `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  return { board, ada }
}

const cookOf = async (caller: Caller, boardId: string, plannedId: string) =>
  (await getBoard(caller, boardId)).plannedDishes.find(p => p.id === plannedId)?.cookId

test('a cook who isn\'t a Member of the Board is refused, the Operator not belonging to it included', async () => {
  const [MONDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  await cookRaw(ada, planned.id, await idOf(grace))
  const before = await versionOf(ada, board.id)
  const watch = await watchEvents()

  for (const cookId of [await idOf(await outsider()), await idOf(await operator()), 'nobody-by-that-id']) {
    const res = await cookRaw(ada, planned.id, cookId)
    expect(res.status).toBe(400)
    expect((await res.json()).statusMessage).toBe('Cook not a Member of this Board')
  }
  // The Operator can set the cook of a Board they visit, but isn't one themselves.
  expect((await cookRaw(await operator(), planned.id, await idOf(await operator()))).status).toBe(400)

  expect(await cookOf(ada, board.id, planned.id)).toBe(await idOf(grace))
  expect(await versionOf(ada, board.id)).toBe(before)
  expect(await watch.recorded()).toEqual([])
})

test.each([
  ['no cook', {}],
  ['an empty cook', { cookId: '' }],
  ['a cook that isn\'t text', { cookId: 7 }],
])('setting the cook with %s is a bad request', async (_, body) => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const planned = await plan(ada, board.id, await addDish(ada, board.id, 'Ramen'), MONDAY)

  expect((await send(ada, 'PUT', `/api/planned-dishes/${planned.id}/cook`, body)).status).toBe(400)
  expect((await send(ada, 'PUT', `/api/planned-dishes/${planned.id}/cook`)).status).toBe(400)
  expect(await cookOf(ada, board.id, planned.id)).toBeNull()
})

test('without "move Dishes" a Member can\'t set the cook; the Owner and the Operator can', async () => {
  const [MONDAY] = freshDays()
  const { board, ada, grace } = await quiet()
  const planned = await plan(ada, board.id, await addDish(ada, board.id, 'Ramen'), MONDAY)
  const [adaId, graceId] = [await idOf(ada), await idOf(grace)]

  const refused = await cookRaw(grace, planned.id, graceId)
  expect(refused.status).toBe(403)
  expect((await refused.json()).data).toEqual({ permission: 'moveDishes' })
  expect((await cookRaw(grace, planned.id, null)).status).toBe(403)
  expect(await cookOf(grace, board.id, planned.id)).toBeNull()

  expect((await cookRaw(ada, planned.id, graceId)).status).toBe(200)
  expect(await cookOf(grace, board.id, planned.id)).toBe(graceId)
  // The Operator isn't a Member here, so may set a Member but is no cook.
  expect((await cookRaw(await operator(), planned.id, adaId)).status).toBe(200)
  expect(await cookOf(ada, board.id, planned.id)).toBe(adaId)
})

test('with "move Dishes" any Member sets anyone\'s cook; someone who isn\'t a Member gets "not found"', async () => {
  const [MONDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const planned = await plan(ada, board.id, await addDish(ada, board.id, 'Ramen'), MONDAY)

  expect((await cookRaw(grace, planned.id, await idOf(ada))).status).toBe(200)
  expect((await cookRaw(await outsider(), planned.id, null)).status).toBe(404)
  expect(await cookOf(ada, board.id, planned.id)).toBe(await idOf(ada))
})

test('two Planned Dishes of one Dish keep their own cooks', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const monday = await plan(ada, board.id, ramen, MONDAY)
  const tuesday = await plan(ada, board.id, ramen, TUESDAY)
  const [adaId, graceId] = [await idOf(ada), await idOf(grace)]

  await cookRaw(ada, monday.id, adaId)
  await cookRaw(ada, tuesday.id, graceId)
  expect(onTestDays((await getBoard(grace, board.id)).plannedDishes).map(p => [p.id, p.cookId])).toEqual([[monday.id, adaId], [tuesday.id, graceId]])

  await cookRaw(ada, monday.id, null)
  expect(onTestDays((await getBoard(grace, board.id)).plannedDishes).map(p => [p.id, p.cookId])).toEqual([[monday.id, null], [tuesday.id, graceId]])
  // Moving a Planned Dish keeps its cook.
  expect((await move(ada, tuesday, MONDAY)).cookId).toBe(graceId)
})

test('setting the cook moves the Board Version and records planned_dish_cook_set; setting the same cook again does neither', async () => {
  const [MONDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const [adaId, graceId] = [await idOf(ada), await idOf(grace)]
  const watch = await watchEvents()
  const start = await versionOf(ada, board.id)

  await cookRaw(grace, planned.id, graceId)
  const afterSet = await versionOf(ada, board.id)
  expect(afterSet).toBeGreaterThan(start)
  // The same cook again: still answered, nothing changes.
  const again = await cookRaw(ada, planned.id, graceId)
  expect(again.status).toBe(200)
  expect(await again.json()).toEqual({ id: planned.id, dishId: ramen.id, day: MONDAY, cookId: graceId })
  expect(await versionOf(ada, board.id)).toBe(afterSet)

  await cookRaw(ada, planned.id, adaId)
  const afterChange = await versionOf(ada, board.id)
  expect(afterChange).toBeGreaterThan(afterSet)
  await cookRaw(ada, planned.id, null)
  const afterClear = await versionOf(ada, board.id)
  expect(afterClear).toBeGreaterThan(afterChange)
  // Nobody cooks it already.
  expect((await cookRaw(ada, planned.id, null)).status).toBe(200)
  expect(await versionOf(ada, board.id)).toBe(afterClear)

  expect(await watch.recorded()).toEqual([
    { kind: 'planned_dish_cook_set', boardId: board.id, dishId: ramen.id, userId: graceId, details: { plannedDish: planned.id, member: graceId } },
    { kind: 'planned_dish_cook_set', boardId: board.id, dishId: ramen.id, userId: adaId, details: { plannedDish: planned.id, member: adaId } },
    { kind: 'planned_dish_cook_set', boardId: board.id, dishId: ramen.id, userId: adaId, details: { plannedDish: planned.id } },
  ])
})

test('a Planned Dish of an Archived Dish has no cook set; restored, it does again', async () => {
  const [MONDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  expect((await send(ada, 'DELETE', `/api/dishes/${ramen.id}`)).status).toBe(204)

  expect((await cookRaw(ada, planned.id, await idOf(grace))).status).toBe(404)
  expect((await cookRaw(ada, randomUUID(), null)).status).toBe(404)
  expect((await cookRaw(ada, 'not-a-planned-dish', null)).status).toBe(404)

  expect((await send(ada, 'POST', `/api/dishes/${ramen.id}/restore`)).status).toBe(200)
  expect((await cookRaw(ada, planned.id, await idOf(grace))).status).toBe(200)
})

test('a cook who leaves is no cook any more, on every Planned Dish of that Board, which all stay', async () => {
  const [MONDAY, TUESDAY, WEDNESDAY] = freshDays()
  const cook = await leaver()
  const { board, ada } = await boardWith('Verlassen', cook)
  const cookId = await idOf(cook)
  const [a, b] = await Promise.all(['A', 'B'].map(t => addDish(ada, board.id, t)))
  const first = await plan(ada, board.id, a!, MONDAY)
  const second = await plan(ada, board.id, b!, TUESDAY)
  const notTheirs = await plan(ada, board.id, a!, WEDNESDAY)
  const adaId = await idOf(ada)
  await cookRaw(ada, first.id, cookId)
  await cookRaw(ada, second.id, cookId)
  await cookRaw(ada, notTheirs.id, adaId)
  // One of their Planned Dishes is on an Archived Dish.
  expect((await send(ada, 'DELETE', `/api/dishes/${b!.id}`)).status).toBe(204)
  const watch = await watchEvents()

  expect((await send(cook, 'DELETE', `/api/boards/${board.id}/members/${cookId}`)).status).toBe(204)

  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes).map(p => [p.id, p.cookId])).toEqual([[first.id, null], [notTheirs.id, adaId]])
  expect((await send(ada, 'POST', `/api/dishes/${b!.id}/restore`)).status).toBe(200)
  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes).map(p => [p.id, p.cookId])).toEqual([[first.id, null], [second.id, null], [notTheirs.id, adaId]])
  // The clearing is no event of its own.
  expect((await watch.recorded()).map(e => e.kind)).toEqual(['member_left', 'dish_restored'])
})

test('a cook the Owner removes is no cook any more either', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const cook = await leaver()
  const { board, ada } = await boardWith('Entfernen', cook)
  const cookId = await idOf(cook)
  const ramen = await addDish(ada, board.id, 'Ramen')
  const first = await plan(ada, board.id, ramen, MONDAY)
  const second = await plan(ada, board.id, ramen, TUESDAY)
  await cookRaw(ada, first.id, cookId)
  await cookRaw(ada, second.id, cookId)

  expect((await send(ada, 'DELETE', `/api/boards/${board.id}/members/${cookId}`)).status).toBe(204)

  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes).map(p => [p.id, p.cookId])).toEqual([[first.id, null], [second.id, null]])
})

test('a cook on two Boards who leaves one keeps their cooks on the other', async () => {
  const [MONDAY] = freshDays()
  const cook = await leaver()
  const cookId = await idOf(cook)
  const left = await boardWith('Erstes Board', cook)
  const grace = await member()
  const stayed = await newBoard(grace, 'Zweites Board')
  expect((await send(cook, 'POST', `/api/invites/${stayed.inviteToken}/join`)).status).toBe(200)
  const onLeft = await plan(left.ada, left.board.id, await addDish(left.ada, left.board.id, 'Ramen'), MONDAY)
  const onStayed = await plan(grace, stayed.id, await addDish(grace, stayed.id, 'Gnocchi'), MONDAY)
  await cookRaw(left.ada, onLeft.id, cookId)
  await cookRaw(grace, onStayed.id, cookId)

  expect((await send(cook, 'DELETE', `/api/boards/${left.board.id}/members/${cookId}`)).status).toBe(204)

  expect(await cookOf(left.ada, left.board.id, onLeft.id)).toBeNull()
  expect(await cookOf(grace, stayed.id, onStayed.id)).toBe(cookId)
})

test('archiving a Board and restoring it keeps its cooks', async () => {
  const [MONDAY] = freshDays()
  const cook = await leaver()
  const cookId = await idOf(cook)
  const { board, ada } = await boardWith('Archiv', cook)
  const planned = await plan(ada, board.id, await addDish(ada, board.id, 'Ramen'), MONDAY)
  await cookRaw(ada, planned.id, cookId)

  expect((await send(ada, 'DELETE', `/api/boards/${board.id}`)).status).toBe(204)
  expect((await send(ada, 'POST', `/api/boards/${board.id}/restore`)).status).toBe(200)

  for (const caller of [ada, cook]) expect(await cookOf(caller, board.id, planned.id)).toBe(cookId)
})

test('a cook who deletes their account is no cook any more, and the event of setting them keeps no one', async () => {
  const [MONDAY] = freshDays()
  const gone = await deleter()
  const goneId = await idOf(gone)
  const { board, ada } = await boardWith('Konto weg', gone)
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const watch = await watchEvents()
  await cookRaw(ada, planned.id, goneId)
  const username = ((await (await gone.fetch('/api/me')).json()) as { name: string }).name

  const res = await send(gone, 'DELETE', '/api/me', { username })
  expect(res.status, await res.clone().text()).toBe(204)

  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes)).toEqual([{ id: planned.id, dishId: ramen.id, day: MONDAY, cookId: null }])
  expect((await watch.recorded()).filter(e => e.kind === 'planned_dish_cook_set')).toEqual([
    { kind: 'planned_dish_cook_set', boardId: board.id, dishId: ramen.id, userId: await idOf(ada), details: { plannedDish: planned.id } },
  ])
})

// Week Plan changes that arrive late (#515; CONTEXT.md: Unsent Change; ADR
// 0012): each write can carry `madeAt`, the time it was made offline, and is
// applied to the Board as it is by then. The plan's own made-at time is not
// exposed by the API (nor is it in the Event Log, which goes by arrival), so
// no test reads it back; a move, an unplan and a cook change store no time,
// the last one to arrive wins.

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

test('each of the four writes applies when it arrives late, with the time it was made', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const [a, b] = await Promise.all(['A', 'B'].map(t => addDish(ada, board.id, t)))
  const graceId = await idOf(grace)

  const res = await planRaw(grace, board.id, { id: randomUUID(), dishId: a!.id, day: MONDAY, madeAt: minutesAgo(90) })
  expect(res.status, await res.clone().text()).toBe(201)
  const planned = await res.json() as Planned
  expect(planned).toMatchObject({ dishId: a!.id, day: MONDAY, cookId: null })
  // A made-at time in the future (a wrong clock) is no reason to refuse.
  const later = await planRaw(grace, board.id, { id: randomUUID(), dishId: b!.id, day: MONDAY, madeAt: new Date(Date.now() + 3600_000).toISOString() })
  expect(later.status).toBe(201)
  const watch = await watchEvents()

  const moved = await send(grace, 'PATCH', `/api/planned-dishes/${planned.id}`, { day: TUESDAY, madeAt: minutesAgo(60) })
  expect(moved.status, await moved.clone().text()).toBe(200)
  expect(await moved.json()).toMatchObject({ id: planned.id, day: TUESDAY })

  const cooked = await send(grace, 'PUT', `/api/planned-dishes/${planned.id}/cook`, { cookId: graceId, madeAt: minutesAgo(45) })
  expect(cooked.status, await cooked.clone().text()).toBe(200)
  expect(await cooked.json()).toMatchObject({ id: planned.id, cookId: graceId })

  const unplanned = await send(grace, 'DELETE', `/api/planned-dishes/${planned.id}`, { madeAt: minutesAgo(30) })
  expect(unplanned.status, await unplanned.clone().text()).toBe(204)

  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes).map(p => p.dishId)).toEqual([b!.id])
  // The Event Log goes by arrival, as for other late changes.
  expect((await watch.recorded()).map(e => e.kind)).toEqual(['planned_dish_moved', 'planned_dish_cook_set', 'dish_unplanned'])
})

test('a made-at time that isn\'t a time is a bad request for all four writes', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const before = await versionOf(ada, board.id)

  for (const madeAt of ['yesterday', '2031-01-01', 20310101]) {
    expect((await planRaw(ada, board.id, { id: randomUUID(), dishId: ramen.id, day: TUESDAY, madeAt })).status).toBe(400)
    expect((await moveRaw(ada, planned.id, { day: TUESDAY, madeAt })).status).toBe(400)
    expect((await send(ada, 'PUT', `/api/planned-dishes/${planned.id}/cook`, { cookId: null, madeAt })).status).toBe(400)
    expect((await send(ada, 'DELETE', `/api/planned-dishes/${planned.id}`, { madeAt })).status).toBe(400)
  }

  expect(await planOf(ada, board.id)).toEqual([[MONDAY, planned.id]])
  expect(await versionOf(ada, board.id)).toBe(before)
})

test('a move that arrives late wins over the moves made meanwhile', async () => {
  const [MONDAY, TUESDAY, WEDNESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)

  // Ada moves it to Tuesday offline; Grace moves it to Wednesday meanwhile.
  expect((await moveRaw(grace, planned.id, { day: WEDNESDAY })).status).toBe(200)
  expect(await planOf(grace, board.id)).toEqual([[WEDNESDAY, planned.id]])

  // Ada's move, made before Grace's, arrives after it: it is applied to the plan as it is by then.
  expect((await moveRaw(ada, planned.id, { day: TUESDAY, madeAt: minutesAgo(120) })).status).toBe(200)

  expect(await planOf(grace, board.id)).toEqual([[TUESDAY, planned.id]])
})

test('a late move is placed at its index among the day\'s Planned Dishes as they are by then', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const [a, b, c] = await Promise.all(['A', 'B', 'C'].map(t => addDish(ada, board.id, t)))
  const [first, second] = [await plan(ada, board.id, a!, TUESDAY), await plan(ada, board.id, b!, TUESDAY)]
  const moving = await plan(ada, board.id, c!, MONDAY)
  // Grace adds one at the top of Tuesday meanwhile.
  const meanwhile = await plan(grace, board.id, c!, TUESDAY, 0)

  expect((await moveRaw(ada, moving.id, { day: TUESDAY, index: 1, madeAt: minutesAgo(60) })).status).toBe(200)

  expect(await dayOf(ada, board.id, TUESDAY)).toEqual([meanwhile.id, moving.id, first.id, second.id])
})

test('two late plans on one day both land, each at its index or at the end, in the order they arrive', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const [a, b, c] = await Promise.all(['A', 'B', 'C'].map(t => addDish(ada, board.id, t)))
  const early = await plan(ada, board.id, a!, MONDAY)
  const planLate = (caller: Caller, dish: Dish, day: string, minutes: number, index?: number) =>
    planRaw(caller, board.id, { id: randomUUID(), dishId: dish.id, day, index, madeAt: minutesAgo(minutes) }).then(async (res) => {
      expect(res.status, await res.clone().text()).toBe(201)
      return res.json() as Promise<Planned>
    })

  // At the end: the one that arrives first is first, whoever made it first.
  const second = await planLate(grace, b!, MONDAY, 10)
  const third = await planLate(ada, c!, MONDAY, 50)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([early.id, second.id, third.id])

  // At the same index: each is placed where it says, the later arrival in front.
  const x = await planLate(ada, a!, TUESDAY, 50, 0)
  const y = await planLate(grace, b!, TUESDAY, 10, 0)
  const z = await planLate(grace, c!, TUESDAY, 30, 1)
  expect(await dayOf(ada, board.id, TUESDAY)).toEqual([y.id, z.id, x.id])
})

test('a plan for a Dish that was archived, deleted for good or moved to another Board meanwhile is dropped, with "Dish not found"', async () => {
  const [MONDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const target = await targetBoard()
  const [archived, purged, moved] = await Promise.all(['Archiviert', 'Gelöscht', 'Verschoben'].map(t => addDish(ada, board.id, t)))
  expect((await send(ada, 'DELETE', `/api/dishes/${archived!.id}`)).status).toBe(204)
  expect((await send(ada, 'DELETE', `/api/dishes/${purged!.id}`)).status).toBe(204)
  expect((await send(ada, 'POST', `/api/dishes/${purged!.id}/purge`)).status).toBe(204)
  expect((await send(ada, 'POST', `/api/dishes/${moved!.id}/move`, { columnId: target.columns[0]!.id })).status).toBe(200)
  const before = await versionOf(grace, board.id)
  const watch = await watchEvents()

  for (const dish of [archived!, purged!, moved!]) {
    const res = await planRaw(grace, board.id, { id: randomUUID(), dishId: dish.id, day: MONDAY, madeAt: minutesAgo(60) })
    expect(res.status).toBe(404)
    expect((await res.json()).statusMessage).toBe('Dish not found')
  }

  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes)).toEqual([])
  expect(await versionOf(grace, board.id)).toBe(before)
  expect(await watch.recorded()).toEqual([])
})

test('a move, unplan or cook change for a Planned Dish that was unplanned, deleted with its Dish or whose Dish is archived is dropped, with "Planned Dish not found"', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const [unplanned, purged, archived] = await Promise.all(['Ausgeplant', 'Gelöscht', 'Archiviert'].map(t => addDish(ada, board.id, t)))
  const gone = await plan(ada, board.id, unplanned!, MONDAY)
  const withPurged = await plan(ada, board.id, purged!, MONDAY)
  const hidden = await plan(ada, board.id, archived!, MONDAY)
  expect((await unplanRaw(ada, gone.id)).status).toBe(204)
  expect((await send(ada, 'DELETE', `/api/dishes/${purged!.id}`)).status).toBe(204)
  expect((await send(ada, 'POST', `/api/dishes/${purged!.id}/purge`)).status).toBe(204)
  expect((await send(ada, 'DELETE', `/api/dishes/${archived!.id}`)).status).toBe(204)
  const before = await versionOf(grace, board.id)
  const watch = await watchEvents()
  const madeAt = minutesAgo(60)

  for (const planned of [gone, withPurged, hidden]) {
    for (const res of [
      await moveRaw(grace, planned.id, { day: TUESDAY, madeAt }),
      await unplanRaw(grace, planned.id),
      await send(grace, 'DELETE', `/api/planned-dishes/${planned.id}`, { madeAt }),
      await send(grace, 'PUT', `/api/planned-dishes/${planned.id}/cook`, { cookId: await idOf(grace), madeAt }),
    ]) {
      expect(res.status).toBe(404)
      expect((await res.json()).statusMessage).toBe('Planned Dish not found')
    }
  }

  expect(await versionOf(grace, board.id)).toBe(before)
  expect(await watch.recorded()).toEqual([])
  // The one of the archived Dish is only hidden: restored, it is where it was.
  expect((await send(ada, 'POST', `/api/dishes/${archived!.id}/restore`)).status).toBe(200)
  expect(await planOf(ada, board.id)).toEqual([[MONDAY, hidden.id]])
})

test('a cook change for a cook who left the Board meanwhile is dropped, with "Cook not a Member of this Board"', async () => {
  const [MONDAY] = freshDays()
  const cook = await leaver()
  const { board, ada } = await boardWith('Kein Mitglied mehr', cook)
  const cookId = await idOf(cook)
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  expect((await send(cook, 'DELETE', `/api/boards/${board.id}/members/${cookId}`)).status).toBe(204)
  const before = await versionOf(ada, board.id)

  const res = await send(ada, 'PUT', `/api/planned-dishes/${planned.id}/cook`, { cookId, madeAt: minutesAgo(60) })

  expect(res.status).toBe(400)
  expect((await res.json()).statusMessage).toBe('Cook not a Member of this Board')
  expect(await cookOf(ada, board.id, planned.id)).toBeNull()
  expect(await versionOf(ada, board.id)).toBe(before)
})

test('all four writes made while the Permission to move Dishes was on are dropped once it is off, with its name', async () => {
  const [MONDAY, TUESDAY] = freshDays()
  const { board, ada, grace } = await quiet()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const planned = await plan(ada, board.id, ramen, MONDAY)
  const graceId = await idOf(grace)
  const before = await versionOf(ada, board.id)
  const watch = await watchEvents()
  const madeAt = minutesAgo(60)

  for (const res of [
    await planRaw(grace, board.id, { id: randomUUID(), dishId: ramen.id, day: TUESDAY, madeAt }),
    await moveRaw(grace, planned.id, { day: TUESDAY, madeAt }),
    await send(grace, 'PUT', `/api/planned-dishes/${planned.id}/cook`, { cookId: graceId, madeAt }),
    await send(grace, 'DELETE', `/api/planned-dishes/${planned.id}`, { madeAt }),
  ]) {
    expect(res.status).toBe(403)
    expect((await res.json()).data).toEqual({ permission: 'moveDishes' })
  }

  expect(await planOf(ada, board.id)).toEqual([[MONDAY, planned.id]])
  expect(await cookOf(ada, board.id, planned.id)).toBeNull()
  expect(await versionOf(ada, board.id)).toBe(before)
  expect(await watch.recorded()).toEqual([])
})

test('the same plan sent twice plans once: both answer 201 with the same Planned Dish, one event, one move of the Board Version', async () => {
  const [MONDAY] = freshDays()
  const { board, ada, grace } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const other = await addDish(ada, board.id, 'Gnocchi')
  const sent = { id: randomUUID(), dishId: ramen.id, day: MONDAY, madeAt: minutesAgo(60) }
  const watch = await watchEvents()
  const start = await versionOf(grace, board.id)

  const first = await planRaw(grace, board.id, sent)
  const afterFirst = await versionOf(grace, board.id)
  expect(first.status).toBe(201)
  // Another Planned Dish went in front meanwhile, and its cook was set: the repeat answers it as it is now.
  const front = await plan(ada, board.id, other, MONDAY, 0)
  const planned = await first.json() as Planned
  expect((await cookRaw(ada, planned.id, await idOf(grace))).status).toBe(200)
  const afterOthers = await versionOf(grace, board.id)
  const again = await planRaw(grace, board.id, sent)

  expect(again.status).toBe(201)
  expect(await again.json()).toEqual({ ...planned, cookId: await idOf(grace) })
  expect(afterFirst).toBeGreaterThan(start)
  expect(await versionOf(grace, board.id)).toBe(afterOthers)
  expect(await dayOf(ada, board.id, MONDAY)).toEqual([front.id, planned.id])
  expect((await watch.recorded()).filter(e => e.kind === 'dish_planned' && e.dishId === ramen.id)).toHaveLength(1)
})

test('a repeat of a plan whose Dish was archived since is dropped, "Dish not found", and plans nothing again', async () => {
  const [MONDAY] = freshDays()
  const { board, ada } = await plain()
  const ramen = await addDish(ada, board.id, 'Ramen')
  const sent = { id: randomUUID(), dishId: ramen.id, day: MONDAY }
  expect((await planRaw(ada, board.id, sent)).status).toBe(201)
  expect((await send(ada, 'DELETE', `/api/dishes/${ramen.id}`)).status).toBe(204)

  expect((await planRaw(ada, board.id, sent)).status).toBe(404)

  expect(onTestDays((await getBoard(ada, board.id)).plannedDishes)).toEqual([])
  expect((await send(ada, 'POST', `/api/dishes/${ramen.id}/restore`)).status).toBe(200)
  expect(await planOf(ada, board.id)).toEqual([[MONDAY, sent.id]])
})

