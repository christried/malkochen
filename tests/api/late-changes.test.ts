import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { loggedAt } from './event-log'

// Changes that can arrive late, or twice (#457; CONTEXT.md: Unsent Change;
// ADR 0012): a change made offline is sent once malkochen answers again,
// with an id the device made for what it adds (a Dish, a Cooking, a
// Comment) and the time it was made. A repeat of an id is already done and
// answers the same; an id that is someone else's is refused. The made-at
// time dates a Cooking, a Comment and a Vote, never later than now, while
// "Neues im Verlauf" and the Event Log go by arrival. A move into a Column
// deleted meanwhile lands at the top of the first Column. Requests without
// these fields are covered by the cooking, dish-move, comments, votes and
// dishes tests, unchanged. Cerf owns the Boards made here, Kahn joins them,
// Liskov has Boards of their own; all three are used by this file only.

interface Person { id: string }
interface Cooking { id: string, cookedAt: string, recordedBy: Person | null }
interface Vote { up: boolean, votedAt: string }
interface Dish {
  id: string
  code: string
  title: string
  cookings: Cooking[]
  votes: Vote[]
  placement: { boardId: string, columnId: string, index: number }
  cooking?: Cooking
}
interface Comment { id: string, text: string, createdAt: string, author: Person | null }
interface Column { id: string, name: string, isGekocht: boolean, dishes: Dish[] }
interface Board { id: string, inviteToken: string, columns: Column[], newInHistoryDishIds: string[] }

const owner = () => signIn(ALLOWLISTED[173])
const member = () => signIn(ALLOWLISTED[174])
const other = () => signIn(ALLOWLISTED[175])

const json = (method: string, body?: unknown): RequestInit =>
  ({ method, ...body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } })
const post = (caller: Caller, path: string, body?: unknown) => caller.fetch(path, json('POST', body))

async function getBoard(caller: Caller, id: string): Promise<Board> {
  const res = await caller.fetch(`/api/boards/${id}`)
  expect(res.status).toBe(200)
  return res.json()
}

// A new Board of `caller`'s, with `members` joined.
async function newBoard(caller: Caller, name: string, members: Caller[] = []): Promise<Board> {
  const res = await post(caller, '/api/boards', { name, emoji: '📶' })
  expect(res.status).toBe(201)
  const { id, inviteToken } = await getBoard(caller, (await res.json() as { id: string }).id)
  for (const joining of members) expect((await post(joining, `/api/invites/${inviteToken}/join`)).status).toBe(200)
  return getBoard(caller, id)
}

// The Board of Cerf's that Kahn has joined, one for the whole file (a user
// may only have so many), and another of Cerf's. Each test adds its own
// Dishes, titled for it alone.
let boards: Promise<{ board: Board, another: Board }> | undefined
async function sharedBoard() {
  const cerf = await owner()
  const kahn = await member()
  boards ??= (async () => ({ board: await newBoard(cerf, 'Unterwegs', [kahn]), another: await newBoard(cerf, 'Andere Tafel') }))()
  const { board, another } = await boards
  return { cerf, kahn, board, another, ideen: board.columns[0]!, gekocht: board.columns.find(c => c.isGekocht)! }
}

async function addDish(caller: Caller, boardId: string, title: string): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

// The Dish as the Board shows it, and where.
async function located(caller: Caller, boardId: string, dishId: string) {
  for (const column of (await getBoard(caller, boardId)).columns) {
    const index = column.dishes.findIndex(d => d.id === dishId)
    if (index !== -1) return { dish: column.dishes[index]!, column, index }
  }
  throw new Error(`Dish ${dishId} is not on the Board`)
}

const dishesTitled = async (caller: Caller, boardId: string, title: string) =>
  (await getBoard(caller, boardId)).columns.flatMap(c => c.dishes).filter(d => d.title === title)

const cook = (caller: Caller, dishId: string, body?: unknown) => post(caller, `/api/dishes/${dishId}/cook`, body)
const move = (caller: Caller, dishId: string, body: unknown) => post(caller, `/api/dishes/${dishId}/move`, body)
const bulk = (caller: Caller, body: unknown) => post(caller, '/api/dishes/bulk', body)
const comment = (caller: Caller, dishId: string, body: unknown) => post(caller, `/api/dishes/${dishId}/comments`, body)
const vote = (caller: Caller, dishId: string, body: unknown) => caller.fetch(`/api/dishes/${dishId}/vote`, json('PUT', body))
const commentsOf = async (caller: Caller, dishId: string): Promise<Comment[]> => {
  const res = await post(caller, `/api/dishes/${dishId}/open`)
  expect(res.status).toBe(200)
  const { entries } = await res.json() as { entries: { kind: string, comment?: Comment }[] }
  return entries.flatMap(e => e.comment ? [e.comment] : [])
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const tomorrow = () => new Date(Date.now() + 24 * 3600_000).toISOString()

// The time `at` names, checked to be between `before` and now: a made-at
// time in the future is clamped to when it arrived.
function expectArrivedBetween(at: string, before: number) {
  const time = new Date(at).getTime()
  // The database's clock, on the same machine: a second's leeway.
  expect(time).toBeGreaterThanOrEqual(before - 1000)
  expect(time).toBeLessThanOrEqual(Date.now() + 1000)
}

// Device-made ids

test('a Dish added twice with the same device-made id is added once, and both answers are the same', async () => {
  const { cerf, board, ideen } = await sharedBoard()
  const id = randomUUID()
  const sent = { id, title: 'Linsensuppe', placeholder: 'bowl' }

  const first = await postDish(cerf, board.id, sent)
  expect(first.status).toBe(201)
  const again = await postDish(cerf, board.id, sent)
  expect(again.status).toBe(201)

  const added = await first.json() as Dish
  expect(added.id).toBe(id)
  expect(added.placement).toEqual({ boardId: board.id, columnId: ideen.id, index: 0 })
  expect(await again.json()).toEqual(added)
  expect(await dishesTitled(cerf, board.id, 'Linsensuppe')).toHaveLength(1)
})

test('two repeats of adding a Dish arriving at once add it once', async () => {
  const { cerf, board } = await sharedBoard()
  const sent = { id: randomUUID(), title: 'Ramen', placeholder: 'bowl' }

  const answers = await Promise.all([postDish(cerf, board.id, sent), postDish(cerf, board.id, sent), postDish(cerf, board.id, sent)])

  expect(answers.map(a => a.status)).toEqual([201, 201, 201])
  const [one, ...rest] = await Promise.all(answers.map(a => a.json()))
  for (const answer of rest) expect(answer).toEqual(one)
  expect(await dishesTitled(cerf, board.id, 'Ramen')).toHaveLength(1)
})

test('a Dish\'s device-made id that is another user\'s Dish, or one on another Board, is refused', async () => {
  const { cerf, kahn, board, another: mine } = await sharedBoard()
  const cerfs = await addDish(cerf, board.id, 'Shakshuka')

  // Kahn sends Cerf's Dish's id; Cerf sends it for another of their Boards.
  expect((await postDish(kahn, board.id, { id: cerfs.id, title: 'Shakshuka', placeholder: 'bowl' })).status).toBe(409)
  expect((await postDish(cerf, mine.id, { id: cerfs.id, title: 'Shakshuka', placeholder: 'bowl' })).status).toBe(409)
  expect(await dishesTitled(cerf, mine.id, 'Shakshuka')).toEqual([])
  expect(await dishesTitled(cerf, board.id, 'Shakshuka')).toHaveLength(1)
})

test('"Gekocht ✓" sent twice with the same Cooking id records one Cooking, and both answers are the same', async () => {
  const { cerf, board, gekocht } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Pad Thai')
  const cookingId = randomUUID()

  const first = await cook(cerf, dish.id, { cookingId })
  expect(first.status).toBe(200)
  const again = await cook(cerf, dish.id, { cookingId })
  expect(again.status).toBe(200)

  const cooked = await first.json() as Dish
  expect(cooked.cooking!.id).toBe(cookingId)
  expect(cooked.placement.columnId).toBe(gekocht.id)
  expect(await again.json()).toEqual(cooked)
  expect((await located(cerf, board.id, dish.id)).dish.cookings.map(c => c.id)).toEqual([cookingId])
})

test('a move into Gekocht sent twice with the same Cooking id records one Cooking', async () => {
  const { cerf, board, gekocht } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Gnocchi')
  const cookingId = randomUUID()

  const first = await move(cerf, dish.id, { columnId: gekocht.id, cookingId })
  const again = await move(cerf, dish.id, { columnId: gekocht.id, cookingId })

  expect(first.status).toBe(200)
  const moved = await first.json() as Dish
  expect(moved.cooking!.id).toBe(cookingId)
  expect(await again.json()).toEqual(moved)
  expect((await located(cerf, board.id, dish.id)).dish.cookings).toHaveLength(1)
})

test('"Gekocht ✓" on several sent twice with the same Cooking ids records one Cooking each', async () => {
  const { cerf, board } = await sharedBoard()
  const dal = await addDish(cerf, board.id, 'Dal')
  const reis = await addDish(cerf, board.id, 'Reis')
  const sent = { action: 'cook', dishIds: [dal.id, reis.id], cookingIds: [randomUUID(), randomUUID()] }

  const first = await bulk(cerf, sent)
  expect(first.status).toBe(200)
  const again = await bulk(cerf, sent)
  expect(again.status).toBe(200)

  const cooked = await first.json() as Dish[]
  expect(cooked.map(d => d.cooking!.id)).toEqual(sent.cookingIds)
  expect(await again.json()).toEqual(cooked)
  for (const dish of [dal, reis]) expect((await located(cerf, board.id, dish.id)).dish.cookings).toHaveLength(1)
})

test('Cooking ids that don\'t match are refused: another user\'s, another Dish\'s, or a different count', async () => {
  const { cerf, kahn, board } = await sharedBoard()
  const dal = await addDish(cerf, board.id, 'Dal')
  const reis = await addDish(cerf, board.id, 'Reis')
  const cookingId = randomUUID()
  expect((await cook(cerf, dal.id, { cookingId })).status).toBe(200)

  // Kahn sends Cerf's Cooking's id; Cerf sends it for another Dish.
  expect((await cook(kahn, dal.id, { cookingId })).status).toBe(409)
  expect((await cook(cerf, reis.id, { cookingId })).status).toBe(409)
  expect((await bulk(cerf, { action: 'cook', dishIds: [reis.id, dal.id], cookingIds: [randomUUID(), cookingId] })).status).toBe(409)
  expect((await bulk(cerf, { action: 'cook', dishIds: [reis.id, dal.id], cookingIds: [randomUUID()] })).status).toBe(400)

  expect((await located(cerf, board.id, dal.id)).dish.cookings).toHaveLength(1)
  expect((await located(cerf, board.id, reis.id)).dish.cookings).toEqual([])
})

test('a Comment sent twice with the same id is written once, and both answers are the same', async () => {
  const { kahn, cerf, board } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Bibimbap')
  const sent = { id: randomUUID(), text: 'Mit mehr Kimchi!' }

  const first = await comment(kahn, dish.id, sent)
  expect(first.status).toBe(201)
  const again = await comment(kahn, dish.id, sent)
  expect(again.status).toBe(201)

  const written = await first.json() as Comment
  expect(written.id).toBe(sent.id)
  expect(await again.json()).toEqual(written)
  expect((await commentsOf(cerf, dish.id)).map(c => c.text)).toEqual(['Mit mehr Kimchi!'])
})

test('a Comment\'s id that is another user\'s Comment, or on another Dish, is refused', async () => {
  const { kahn, cerf, board } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Bibimbap')
  const other = await addDish(cerf, board.id, 'Japchae')
  const id = randomUUID()
  expect((await comment(kahn, dish.id, { id, text: 'Lecker' })).status).toBe(201)

  expect((await comment(cerf, dish.id, { id, text: 'Lecker' })).status).toBe(409)
  expect((await comment(kahn, other.id, { id, text: 'Lecker' })).status).toBe(409)
  expect(await commentsOf(cerf, dish.id)).toHaveLength(1)
  expect(await commentsOf(cerf, other.id)).toEqual([])
})

// Made-at times

test('a Cooking made offline is dated when it was tapped; one dated in the future, when it arrived', async () => {
  const { cerf, board } = await sharedBoard()
  const earlier = await addDish(cerf, board.id, 'Ofengemüse')
  const later = await addDish(cerf, board.id, 'Flammkuchen')
  const madeAt = minutesAgo(120)

  const cooked = await (await cook(cerf, earlier.id, { cookingId: randomUUID(), madeAt })).json() as Dish
  expect(cooked.cooking!.cookedAt).toBe(madeAt)

  const before = Date.now()
  const clamped = await (await cook(cerf, later.id, { madeAt: tomorrow() })).json() as Dish
  expectArrivedBetween(clamped.cooking!.cookedAt, before)

  // The several-Dishes "Gekocht ✓" and a move into Gekocht too.
  const [bulkCooked] = await (await bulk(cerf, { action: 'cook', dishIds: [later.id], madeAt })).json() as Dish[]
  expect(bulkCooked!.cooking!.cookedAt).toBe(madeAt)
})

test('a move into Gekocht made offline dates its Cooking when it was made', async () => {
  const { cerf, board, gekocht } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Quiche')
  const madeAt = minutesAgo(45)

  const moved = await (await move(cerf, dish.id, { columnId: gekocht.id, madeAt })).json() as Dish
  expect(moved.cooking!.cookedAt).toBe(madeAt)
})

test('"Rückgängig" still takes back a Cooking made offline long before it arrived', async () => {
  const { cerf, board, ideen } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Couscous')
  const cooked = await (await cook(cerf, dish.id, { cookingId: randomUUID(), madeAt: minutesAgo(90) })).json() as Dish

  const undone = await post(cerf, `/api/cookings/${cooked.cooking!.id}/undo`, { columnId: ideen.id, index: 0 })
  expect(undone.status).toBe(200)
  expect((await located(cerf, board.id, dish.id)).dish.cookings).toEqual([])
})

test('a Comment written offline is dated when it was written; one dated in the future, when it arrived', async () => {
  const { kahn, cerf, board } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Tacos')
  const madeAt = minutesAgo(30)

  const late = await (await comment(kahn, dish.id, { id: randomUUID(), text: 'Von gestern Abend', madeAt })).json() as Comment
  expect(late.createdAt).toBe(madeAt)

  const before = Date.now()
  const clamped = await (await comment(kahn, dish.id, { text: 'Aus der Zukunft', madeAt: tomorrow() })).json() as Comment
  expectArrivedBetween(clamped.createdAt, before)
})

test('a Vote given or changed offline is dated when it was; one dated in the future, when it arrived', async () => {
  const { kahn, cerf, board } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Lasagne')
  expect((await cook(cerf, dish.id)).status).toBe(200)

  const given = minutesAgo(50)
  const vote1 = await vote(kahn, dish.id, { up: true, madeAt: given })
  expect(vote1.status).toBe(200)
  expect((await vote1.json() as Vote).votedAt).toBe(given)

  const changed = minutesAgo(20)
  expect((await (await vote(kahn, dish.id, { up: false, madeAt: changed })).json() as Vote).votedAt).toBe(changed)

  const before = Date.now()
  expectArrivedBetween((await (await vote(kahn, dish.id, { up: true, madeAt: tomorrow() })).json() as Vote).votedAt, before)
})

test('a malformed made-at time is refused', async () => {
  const { cerf, board } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Suppe')
  expect((await cook(cerf, dish.id, { madeAt: 'gestern' })).status).toBe(400)
  expect((await comment(cerf, dish.id, { text: 'Hm', madeAt: 'gestern' })).status).toBe(400)
  expect((await cook(cerf, dish.id, { cookingId: 'not-a-uuid' })).status).toBe(400)
})

// What goes by arrival

test('a Comment, Cooking and Vote dated before the Member last opened the Dish still mark it new, as they arrived after', async () => {
  const { kahn, cerf, board } = await sharedBoard()
  const dal = await addDish(cerf, board.id, 'Dal')
  const curry = await addDish(cerf, board.id, 'Curry')
  const reis = await addDish(cerf, board.id, 'Reis')
  expect((await cook(cerf, reis.id)).status).toBe(200)
  const beforeOpening = minutesAgo(10)
  for (const dish of [dal, curry, reis]) await commentsOf(cerf, dish.id)
  const marked = async () => (await getBoard(cerf, board.id)).newInHistoryDishIds.filter(id => [dal.id, curry.id, reis.id].includes(id))
  expect(await marked()).toEqual([])

  expect((await comment(kahn, dal.id, { id: randomUUID(), text: 'Gestern gemacht', madeAt: beforeOpening })).status).toBe(201)
  expect((await cook(kahn, curry.id, { cookingId: randomUUID(), madeAt: beforeOpening })).status).toBe(200)
  expect((await vote(kahn, reis.id, { up: true, madeAt: beforeOpening })).status).toBe(200)

  expect((await marked()).toSorted()).toEqual([dal.id, curry.id, reis.id].toSorted())
})

test('a late Comment\'s Event Log entry is at its arrival, not when it was written', async () => {
  const { kahn, cerf, board } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Paella')
  const before = Date.now()

  expect((await comment(kahn, dish.id, { text: 'Von heute Mittag', madeAt: minutesAgo(240) })).status).toBe(201)

  const [at] = await loggedAt('comment_written', dish.id)
  expectArrivedBetween(at!.toISOString(), before)
})

// What can't apply any more

test('a late change to a Dish archived meanwhile is refused as today', async () => {
  const { kahn, cerf, board } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Rührei')
  expect((await cerf.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })).status).toBe(204)

  expect((await cook(kahn, dish.id, { cookingId: randomUUID(), madeAt: minutesAgo(5) })).status).toBe(404)
  expect((await comment(kahn, dish.id, { id: randomUUID(), text: 'Hm', madeAt: minutesAgo(5) })).status).toBe(404)
})

// A move into a deleted Column

async function deletedColumn(caller: Caller, boardId: string): Promise<string> {
  const res = await post(caller, `/api/boards/${boardId}/columns`, { name: 'Bald weg' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  expect((await caller.fetch(`/api/columns/${id}`, { method: 'DELETE' })).status).toBe(204)
  return id
}

test('a move into a Column deleted meanwhile lands at the top of the Board\'s first Column', async () => {
  const { cerf, kahn, board, ideen } = await sharedBoard()
  const dieseWoche = board.columns[1]!
  const dish = await addDish(cerf, board.id, 'Kartoffelsalat')
  await addDish(cerf, board.id, 'Obenauf')
  expect((await move(cerf, dish.id, { columnId: dieseWoche.id })).status).toBe(200)
  const gone = await deletedColumn(cerf, board.id)

  // Dropped at an index, too: the top.
  const res = await move(kahn, dish.id, { columnId: gone, index: 3, madeAt: minutesAgo(5) })
  expect(res.status).toBe(200)
  expect((await res.json() as Dish).placement).toEqual({ boardId: board.id, columnId: ideen.id, index: 0 })
  expect((await located(cerf, board.id, dish.id)).dish.cookings).toEqual([])
})

test('without a made-at time, a missing Column is refused as ever', async () => {
  const { cerf, board } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Ohne Zeit')
  const gone = await deletedColumn(cerf, board.id)

  expect((await move(cerf, dish.id, { columnId: gone })).status).toBe(400)
  expect((await bulk(cerf, { action: 'move', dishIds: [dish.id], columnId: gone })).status).toBe(400)
})

test('a move of several into a Column deleted meanwhile lands them at the top of the first Column, in order', async () => {
  const { cerf, board, ideen } = await sharedBoard()
  const dieseWoche = board.columns[1]!
  const one = await addDish(cerf, board.id, 'Eins')
  const two = await addDish(cerf, board.id, 'Zwei')
  await addDish(cerf, board.id, 'Bleibt')
  expect((await bulk(cerf, { action: 'move', dishIds: [one.id, two.id], columnId: dieseWoche.id })).status).toBe(200)
  const gone = await deletedColumn(cerf, board.id)

  const res = await bulk(cerf, { action: 'move', dishIds: [one.id, two.id], columnId: gone, madeAt: minutesAgo(5) })
  expect(res.status).toBe(200)
  expect((await res.json() as Dish[]).map(d => d.placement)).toEqual([
    { boardId: board.id, columnId: ideen.id, index: 0 },
    { boardId: board.id, columnId: ideen.id, index: 1 },
  ])
})

test('a Column that never existed, for a Dish of someone else\'s Board, is still not found', async () => {
  const { cerf, board } = await sharedBoard()
  const dish = await addDish(cerf, board.id, 'Geheim')
  const liskov = await other()

  expect((await move(liskov, dish.id, { columnId: randomUUID(), madeAt: minutesAgo(5) })).status).toBe(404)
  expect((await located(cerf, board.id, dish.id)).column.id).toBe(board.columns[0]!.id)
})
