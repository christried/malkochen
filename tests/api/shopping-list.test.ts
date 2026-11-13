import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { OPERATOR } from '../support/test-auth-env'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { startPushService, type PushService } from './push-service'
import { startResendService, type ResendService } from '../support/resend-service'
import { CRON_SECRET } from './server-env'
import { backdateDeletion, endLimitWindows } from './time-travel'

// The Shopping List on a Board (#530–#533, CONTEXT.md: Shopping List,
// Shopping Item; ADR 0015). Items typed into "Sonstiges"
// (POST /api/boards/:id/shopping-items), changed, ticked and unticked
// (PATCH /api/shopping-items/:id), deleted (DELETE), every ticked one cleared
// (POST …/shopping-items/clear) and brought back by "Rückgängig"
// (POST …/shopping-items/restore); a Dish put on with its chosen Ingredients
// (POST …/shopping-items/dish, #531), and a week of the Week Plan
// (POST …/shopping-items/week, #532). The whole list travels with the Board
// load. [250]–[252] own the Boards made here, taking turns (a user may make
// 20 Boards); [253] joins them all with no Permissions; [254] is the
// outsider; [255] leaves and [256] deletes their account. All are this
// file's only. The Operator (babbage) is shared with other files.

const owners = [ALLOWLISTED[250], ALLOWLISTED[251], ALLOWLISTED[252]]
const member = () => signIn(ALLOWLISTED[253])
const outsider = () => signIn(ALLOWLISTED[254])
const leaver = () => signIn(ALLOWLISTED[255])
const deleter = () => signIn(ALLOWLISTED[256])
const operator = () => signIn(OPERATOR)

interface Item { id: string, text: string, ticked: boolean, dishId: string | null, dishTitle: string | null, dishOnBoard: boolean }
interface Dish { id: string, title: string }
interface Board {
  id: string
  inviteToken: string
  version: number
  shoppingItems: Item[]
  newInHistoryDishIds: string[]
  columns: { id: string, dishes: Dish[] }[]
}

let pushService: PushService
let resend: ResendService
beforeAll(async () => {
  pushService = await startPushService()
  resend = await startResendService()
  await Promise.all([...owners.map(email => signIn(email)), member(), outsider(), operator(), leaver(), deleter()])
})
afterAll(async () => {
  await pushService.close()
  await resend.close()
})
beforeEach(async () => {
  pushService.forget()
  await endLimitWindows('create-board')
})

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, { method, ...body === undefined ? {} : json(body) })

const getBoard = (caller: Caller, id: string): Promise<Board> => caller.fetch(`/api/boards/${id}`).then(res => res.json())
const idOf = async (caller: Caller): Promise<string> => (await (await caller.fetch('/api/me')).json() as { id: string }).id
const versionOf = async (caller: Caller, boardId: string): Promise<number> =>
  (await (await caller.fetch(`/api/boards/${boardId}/version`)).json() as { version: number }).version
const listOf = async (caller: Caller, boardId: string) => (await getBoard(caller, boardId)).shoppingItems
const textsOf = async (caller: Caller, boardId: string) => (await listOf(caller, boardId)).map(i => i.text)

// A new Board, of the owner whose turn it is, that the member joined with
// every Permission switched off.
let turn = 0
async function freshBoard(name = 'Einkauf') {
  const ada = await signIn(owners[turn++ % owners.length]!)
  const grace = await member()
  const res = await send(ada, 'POST', '/api/boards', { name, emoji: '🛒' })
  expect(res.status, await res.clone().text()).toBe(201)
  const board = await getBoard(ada, (await res.json() as { id: string }).id)
  expect((await send(grace, 'POST', `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  const none = { addDishes: false, editDishes: false, moveDishes: false, archiveDishes: false, editColumns: false, shareInvite: false, commentAndVote: false, editBoard: false }
  const res2 = await send(ada, 'PATCH', `/api/boards/${board.id}/members/${await idOf(grace)}/permissions`, none)
  expect(res2.status, await res2.clone().text()).toBe(200)
  return { board, ada, grace }
}

async function addDish(caller: Caller, boardId: string, title: string, ingredients: string[] = []): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  const dish = await res.json() as Dish
  if (ingredients.length > 0) {
    const edit = await send(caller, 'PATCH', `/api/dishes/${dish.id}`, { recipe: { ingredients, steps: [] } })
    expect(edit.status, await edit.clone().text()).toBe(200)
  }
  return dish
}

const addRaw = (caller: Caller, boardId: string, body: Record<string, unknown>) => send(caller, 'POST', `/api/boards/${boardId}/shopping-items`, body)
const changeRaw = (caller: Caller, id: string, body: Record<string, unknown>) => send(caller, 'PATCH', `/api/shopping-items/${id}`, body)
const deleteRaw = (caller: Caller, id: string, body?: unknown) => send(caller, 'DELETE', `/api/shopping-items/${id}`, body)
const clearRaw = (caller: Caller, boardId: string, body?: unknown) => send(caller, 'POST', `/api/boards/${boardId}/shopping-items/clear`, body)
const restoreRaw = (caller: Caller, boardId: string, ids: string[]) => send(caller, 'POST', `/api/boards/${boardId}/shopping-items/restore`, { ids })
const putOnRaw = (caller: Caller, boardId: string, body: Record<string, unknown>) => send(caller, 'POST', `/api/boards/${boardId}/shopping-items/dish`, body)
const weekRaw = (caller: Caller, boardId: string, body: Record<string, unknown>) => send(caller, 'POST', `/api/boards/${boardId}/shopping-items/week`, body)

async function add(caller: Caller, boardId: string, text: string): Promise<Item> {
  const res = await addRaw(caller, boardId, { id: randomUUID(), text })
  expect(res.status, await res.clone().text()).toBe(201)
  return res.json()
}

async function change(caller: Caller, id: string, body: Record<string, unknown>): Promise<Item> {
  const res = await changeRaw(caller, id, body)
  expect(res.status, await res.clone().text()).toBe(200)
  return res.json()
}

// Puts the Dish on with the given lines, each with a new id.
async function putOn(caller: Caller, boardId: string, dish: Dish, lines: string[]): Promise<Item[]> {
  const res = await putOnRaw(caller, boardId, { dishId: dish.id, items: lines.map(text => ({ id: randomUUID(), text })) })
  expect(res.status, await res.clone().text()).toBe(201)
  return res.json()
}

async function plan(caller: Caller, boardId: string, dish: Dish, day: string) {
  const res = await send(caller, 'POST', `/api/boards/${boardId}/planned-dishes`, { id: randomUUID(), dishId: dish.id, day })
  expect(res.status, await res.clone().text()).toBe(201)
}

// --- The list itself (#530) ---------------------------------------------------

test('a Board without a Shopping List carries an empty one', async () => {
  const { board, ada } = await freshBoard()
  expect(await listOf(ada, board.id)).toEqual([])
})

test('the Owner, a Member with no Permissions and the Operator type items into "Sonstiges"; every Member reads the same list back, in order', async () => {
  const { board, ada, grace } = await freshBoard()
  const babbage = await operator()
  const id = randomUUID()

  const res = await addRaw(grace, board.id, { id, text: '  Hafermilch ' })

  expect(res.status).toBe(201)
  expect(await res.json()).toEqual({ id, text: 'Hafermilch', ticked: false, dishId: null, dishTitle: null, dishOnBoard: false })
  await add(ada, board.id, 'Klopapier')
  await add(babbage, board.id, 'Spülmittel')
  for (const caller of [ada, grace, babbage]) {
    expect(await textsOf(caller, board.id)).toEqual(['Hafermilch', 'Klopapier', 'Spülmittel'])
  }
})

test('items are changed, ticked and unticked by any Member, the Owner and the Operator', async () => {
  const { board, ada, grace } = await freshBoard()
  const babbage = await operator()
  const item = await add(ada, board.id, 'Hafermilch')

  expect(await change(grace, item.id, { text: '2 Hafermilch' })).toMatchObject({ id: item.id, text: '2 Hafermilch', ticked: false })
  expect(await change(babbage, item.id, { ticked: true })).toMatchObject({ text: '2 Hafermilch', ticked: true })
  expect(await change(ada, item.id, { ticked: false })).toMatchObject({ ticked: false })
  expect(await change(grace, item.id, { ticked: true })).toMatchObject({ ticked: true })

  expect(await listOf(ada, board.id)).toEqual([{ id: item.id, text: '2 Hafermilch', ticked: true, dishId: null, dishTitle: null, dishOnBoard: false }])
})

test('a change takes either a text or a tick, not both and not neither', async () => {
  const { board, ada } = await freshBoard()
  const item = await add(ada, board.id, 'Hafermilch')

  for (const body of [{}, { text: 'A', ticked: true }, { ticked: 'yes' }, { text: '' }, { text: '   ' }, { text: 'x'.repeat(201) }, { text: 'A', madeAt: 'gestern' }]) {
    expect((await changeRaw(ada, item.id, body)).status, JSON.stringify(body)).toBe(400)
  }
  expect(await textsOf(ada, board.id)).toEqual(['Hafermilch'])
})

test('an item is deleted by any Member, and "Rückgängig" brings it back as it was, in its place', async () => {
  const { board, ada, grace } = await freshBoard()
  const [a, b, c] = [await add(ada, board.id, 'A'), await add(ada, board.id, 'B'), await add(ada, board.id, 'C')]
  await change(ada, b.id, { ticked: true })

  expect((await deleteRaw(grace, b.id)).status).toBe(204)
  expect((await listOf(ada, board.id)).map(i => i.id)).toEqual([a.id, c.id])
  // Gone: deleting or changing it again finds nothing.
  expect((await deleteRaw(ada, b.id)).status).toBe(404)
  expect((await changeRaw(ada, b.id, { ticked: false })).status).toBe(404)

  const res = await restoreRaw(grace, board.id, [b.id])

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual([{ id: b.id, text: 'B', ticked: true, dishId: null, dishTitle: null, dishOnBoard: false }])
  expect((await listOf(ada, board.id)).map(i => i.id)).toEqual([a.id, b.id, c.id])
})

test('"Erledigte entfernen" clears every ticked item for everyone, and "Rückgängig" brings them back with their ids, ticks and places', async () => {
  const { board, ada, grace } = await freshBoard()
  const babbage = await operator()
  const ramen = await addDish(ada, board.id, 'Ramen', ['Nudeln', 'Miso', 'Tofu'])
  const [milk, paper] = [await add(ada, board.id, 'Hafermilch'), await add(ada, board.id, 'Klopapier')]
  const [noodles, miso, tofu] = await putOn(ada, board.id, ramen, ['Nudeln', 'Miso', 'Tofu'])
  for (const item of [milk, noodles!, tofu!]) await change(ada, item.id, { ticked: true })
  const before = await listOf(ada, board.id)

  const res = await clearRaw(grace, board.id)

  expect(res.status).toBe(200)
  const { ids } = await res.json() as { ids: string[] }
  expect(new Set(ids)).toEqual(new Set([milk.id, noodles!.id, tofu!.id]))
  expect((await listOf(babbage, board.id)).map(i => i.id)).toEqual([paper.id, miso!.id])
  // Nothing ticked: clearing clears nothing.
  expect(await (await clearRaw(babbage, board.id)).json()).toEqual({ ids: [] })

  expect((await restoreRaw(babbage, board.id, ids)).status).toBe(200)
  expect(await listOf(grace, board.id)).toEqual(before)
})

test('restoring leaves out ids that aren\'t deleted items of the Board', async () => {
  const { board, ada } = await freshBoard()
  const other = await freshBoard()
  const live = await add(ada, board.id, 'Bleibt')
  const elsewhere = await add(other.ada, other.board.id, 'Woanders')
  expect((await deleteRaw(other.ada, elsewhere.id)).status).toBe(204)

  const res = await restoreRaw(ada, board.id, [live.id, elsewhere.id, randomUUID()])

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual([])
  expect(await textsOf(other.ada, other.board.id)).toEqual([])
})

test.each([
  ['empty', ''],
  ['blank', '   '],
  ['over 200 characters', 'x'.repeat(201)],
])('a text that is %s is refused', async (_, text) => {
  const { board, ada } = await freshBoard()
  expect((await addRaw(ada, board.id, { id: randomUUID(), text })).status).toBe(400)
  expect(await listOf(ada, board.id)).toEqual([])
})

test('a text of 200 characters is fine; an add without an id is a bad request', async () => {
  const { board, ada } = await freshBoard()
  expect((await addRaw(ada, board.id, { id: randomUUID(), text: 'x'.repeat(200) })).status).toBe(201)
  expect((await addRaw(ada, board.id, { text: 'Hafermilch' })).status).toBe(400)
  expect((await addRaw(ada, board.id, { id: 'nope', text: 'Hafermilch' })).status).toBe(400)
})

test('a list holds 500 items: the 501st, a put-on going over and a restore going over are refused whole', async () => {
  const { board, ada } = await freshBoard()
  const lines = Array.from({ length: 60 }, (_, i) => `Zutat ${i + 1}`)
  const big = await addDish(ada, board.id, 'Großeinkauf', lines)
  for (let i = 0; i < 8; i++) await putOn(ada, board.id, big, lines)
  const typed: Item[] = []
  for (let i = 0; i < 20; i++) typed.push(await add(ada, board.id, `Extra ${i}`))
  expect(await listOf(ada, board.id)).toHaveLength(500)

  const res = await addRaw(ada, board.id, { id: randomUUID(), text: 'Zu viel' })
  expect(res.status).toBe(409)
  expect((await putOnRaw(ada, board.id, { dishId: big.id, items: [{ id: randomUUID(), text: 'Zutat 1' }] })).status).toBe(409)

  // Two gone, three to bring back: none comes back.
  for (const item of typed.slice(0, 3)) expect((await deleteRaw(ada, item.id)).status).toBe(204)
  await add(ada, board.id, 'Neu 1')
  expect((await restoreRaw(ada, board.id, typed.slice(0, 3).map(i => i.id))).status).toBe(409)
  expect(await listOf(ada, board.id)).toHaveLength(498)
})

test('someone who isn\'t a Member gets "not found" for every write, and changes nothing', async () => {
  const { board, ada } = await freshBoard()
  const stranger = await outsider()
  const dish = await addDish(ada, board.id, 'Ramen', ['Nudeln'])
  const item = await add(ada, board.id, 'Hafermilch')

  expect((await addRaw(stranger, board.id, { id: randomUUID(), text: 'X' })).status).toBe(404)
  expect((await changeRaw(stranger, item.id, { ticked: true })).status).toBe(404)
  expect((await changeRaw(stranger, item.id, { text: 'X' })).status).toBe(404)
  expect((await deleteRaw(stranger, item.id)).status).toBe(404)
  expect((await clearRaw(stranger, board.id)).status).toBe(404)
  expect((await restoreRaw(stranger, board.id, [item.id])).status).toBe(404)
  expect((await putOnRaw(stranger, board.id, { dishId: dish.id, items: [{ id: randomUUID(), text: 'Nudeln' }] })).status).toBe(404)
  expect((await weekRaw(stranger, board.id, { week: '2031-06-02' })).status).toBe(404)
  expect((await stranger.fetch(`/api/boards/${board.id}`)).status).toBe(404)

  expect(await listOf(ada, board.id)).toEqual([{ ...item }])
})

test('items stay when the Member who added them leaves the Board, or deletes their account', async () => {
  const { board, ada } = await freshBoard()
  const [leaving, deleting] = [await leaver(), await deleter()]
  for (const caller of [leaving, deleting]) expect((await send(caller, 'POST', `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  await add(leaving, board.id, 'Von Gehenden')
  await add(deleting, board.id, 'Vom gelöschten Konto')

  expect((await send(leaving, 'DELETE', `/api/boards/${board.id}/members/${await idOf(leaving)}`)).status).toBe(204)
  const username = ((await (await deleting.fetch('/api/me')).json()) as { name: string }).name
  const res = await send(deleting, 'DELETE', '/api/me', { username })
  expect(res.status, await res.clone().text()).toBe(204)

  expect(await textsOf(ada, board.id)).toEqual(['Von Gehenden', 'Vom gelöschten Konto'])
})

test('each write moves the Board Version; a change to what an item already is moves nothing', async () => {
  const { board, ada, grace } = await freshBoard()
  const ramen = await addDish(ada, board.id, 'Ramen', ['Nudeln'])
  const item = await add(ada, board.id, 'Hafermilch')

  let seen = await versionOf(grace, board.id)
  const moves = async (write: () => Promise<Response>, status: number) => {
    const res = await write()
    expect(res.status, await res.clone().text()).toBe(status)
    const now = await versionOf(grace, board.id)
    expect(now).toBeGreaterThan(seen)
    expect((await getBoard(grace, board.id)).version).toBe(now)
    seen = now
  }
  const stays = async (write: () => Promise<Response>, status: number) => {
    expect((await write()).status).toBe(status)
    expect(await versionOf(grace, board.id)).toBe(seen)
  }

  await moves(() => addRaw(grace, board.id, { id: randomUUID(), text: 'Klopapier' }), 201)
  await moves(() => changeRaw(grace, item.id, { text: '2 Hafermilch' }), 200)
  await stays(() => changeRaw(grace, item.id, { text: '2 Hafermilch' }), 200)
  await moves(() => changeRaw(grace, item.id, { ticked: true }), 200)
  await stays(() => changeRaw(grace, item.id, { ticked: true }), 200)
  await moves(() => changeRaw(grace, item.id, { ticked: false }), 200)
  await moves(() => deleteRaw(grace, item.id), 204)
  await moves(() => restoreRaw(grace, board.id, [item.id]), 200)
  await change(grace, item.id, { ticked: true })
  seen = await versionOf(grace, board.id)
  await moves(() => clearRaw(grace, board.id), 200)
  await stays(() => clearRaw(grace, board.id), 200)
  await moves(() => putOnRaw(grace, board.id, { dishId: ramen.id, items: [{ id: randomUUID(), text: 'Nudeln' }] }), 201)
  await stays(() => addRaw(grace, board.id, { id: randomUUID(), text: '' }), 400)
})

test('each write is in the Event Log with its details, never its text', async () => {
  const { board, ada, grace } = await freshBoard()
  const ramen = await addDish(ada, board.id, 'Ramen', ['Nudeln', 'Miso'])
  const graceId = await idOf(grace)
  const watch = await watchEvents()

  const item = await add(grace, board.id, 'Hafermilch')
  await change(grace, item.id, { text: 'Hafermilch!' })
  await change(grace, item.id, { ticked: true })
  await change(grace, item.id, { ticked: false })
  expect((await deleteRaw(grace, item.id)).status).toBe(204)
  expect((await restoreRaw(grace, board.id, [item.id])).status).toBe(200)
  const lines = await putOn(grace, board.id, ramen, ['Nudeln', 'Miso'])
  for (const line of [item, ...lines]) await change(grace, line.id, { ticked: true })
  expect((await clearRaw(grace, board.id)).status).toBe(200)

  const recorded = (await watch.recorded()).filter(e => e.kind.startsWith('shopping') || e.kind.endsWith('shopping_list'))
  const one = (kind: string) => ({ kind, boardId: board.id, dishId: null, userId: graceId, details: { shoppingItem: item.id } })
  expect(recorded).toEqual([
    one('shopping_item_added'),
    one('shopping_item_changed'),
    one('shopping_item_ticked'),
    one('shopping_item_unticked'),
    one('shopping_item_deleted'),
    { kind: 'shopping_items_restored', boardId: board.id, dishId: null, userId: graceId, details: { items: 1 } },
    { kind: 'dish_put_on_shopping_list', boardId: board.id, dishId: ramen.id, userId: graceId, details: { items: 2 } },
    one('shopping_item_ticked'),
    { ...one('shopping_item_ticked'), details: { shoppingItem: lines[0]!.id } },
    { ...one('shopping_item_ticked'), details: { shoppingItem: lines[1]!.id } },
    { kind: 'shopping_items_cleared', boardId: board.id, dishId: null, userId: graceId, details: { items: 3 } },
  ])
})

test('the list adds nothing to the Dish History or "Neues im Verlauf", and sends no Push Notification', async () => {
  const { board, ada, grace } = await freshBoard()
  const device = pushService.device('grace-shopping')
  expect((await send(grace, 'PUT', '/api/me/push', device.subscription)).status).toBe(204)
  try {
    const ramen = await addDish(ada, board.id, 'Ramen', ['Nudeln'])
    const history = await (await send(grace, 'POST', `/api/dishes/${ramen.id}/open`)).json()
    pushService.forget()

    const [line] = await putOn(ada, board.id, ramen, ['Nudeln'])
    await change(ada, line!.id, { ticked: true })
    expect((await clearRaw(ada, board.id)).status).toBe(200)
    await add(ada, board.id, 'Hafermilch')

    expect((await getBoard(grace, board.id)).newInHistoryDishIds).toEqual([])
    expect(await (await send(grace, 'POST', `/api/dishes/${ramen.id}/open`)).json()).toEqual(history)
    expect(pushService.deliveries).toEqual([])
  }
  finally {
    await send(grace, 'DELETE', '/api/me/push', { endpoint: device.subscription.endpoint })
  }
})

test('the daily cleanup purges items deleted a day ago, and "Rückgängig" can\'t bring those back', async () => {
  const { board, ada } = await freshBoard()
  const [old, recent] = [await add(ada, board.id, 'Alt'), await add(ada, board.id, 'Frisch')]
  for (const item of [old, recent]) expect((await deleteRaw(ada, item.id)).status).toBe(204)
  await backdateDeletion('shopping_item', old.id, 2)

  const res = await anonymous().fetch('/api/cron/cleanup', { headers: { authorization: `Bearer ${CRON_SECRET}` } })
  expect(res.status).toBe(200)
  expect((await res.json() as { purgedShoppingItems: number }).purgedShoppingItems).toBeGreaterThanOrEqual(1)

  expect(await (await restoreRaw(ada, board.id, [old.id, recent.id])).json()).toEqual([expect.objectContaining({ id: recent.id })])
})

// --- Putting a Dish on (#531) -------------------------------------------------

test('a Dish put on goes under its group with the chosen lines, in the order sent, after "Sonstiges"', async () => {
  const { board, ada, grace } = await freshBoard()
  const soup = await addDish(ada, board.id, 'Omas Linsensuppe', ['250 g rote Linsen', '1 Dose gehackte Tomaten', '2 Karotten', '1 Zwiebel'])
  const ids = [randomUUID(), randomUUID(), randomUUID()]

  const res = await putOnRaw(grace, board.id, { dishId: soup.id, items: [
    { id: ids[0], text: '250 g rote Linsen' },
    { id: ids[1], text: '2 Karotten' },
    { id: ids[2], text: '1 Zwiebel' },
  ] })
  await add(grace, board.id, 'Hafermilch')

  expect(res.status).toBe(201)
  const group = { dishId: soup.id, dishTitle: 'Omas Linsensuppe', dishOnBoard: true, ticked: false }
  expect(await res.json()).toEqual([
    { id: ids[0], text: '250 g rote Linsen', ...group },
    { id: ids[1], text: '2 Karotten', ...group },
    { id: ids[2], text: '1 Zwiebel', ...group },
  ])
  expect((await listOf(ada, board.id)).map(i => [i.text, i.dishTitle])).toEqual([
    ['Hafermilch', null],
    ['250 g rote Linsen', 'Omas Linsensuppe'],
    ['2 Karotten', 'Omas Linsensuppe'],
    ['1 Zwiebel', 'Omas Linsensuppe'],
  ])
})

test('putting the same Dish on again appends its lines to its group, which keeps its place among the groups', async () => {
  const { board, ada } = await freshBoard()
  const bowl = await addDish(ada, board.id, 'Crispy Tofu Bowl', ['Tofu', 'Reis'])
  const pasta = await addDish(ada, board.id, 'One-Pot Pasta', ['Penne'])
  await putOn(ada, board.id, bowl, ['Tofu', 'Reis'])
  await putOn(ada, board.id, pasta, ['Penne'])

  await putOn(ada, board.id, bowl, ['Tofu', 'Reis'])

  expect(await textsOf(ada, board.id)).toEqual(['Tofu', 'Reis', 'Tofu', 'Reis', 'Penne'])
})

test('a renamed Dish\'s group shows its new title; archived, moved or deleted for good, its group keeps the last title and stays', async () => {
  const { board, ada } = await freshBoard()
  const target = await freshBoard('Ziel')
  // The owner of `board` joins the target Board to move a Dish there.
  expect((await send(ada, 'POST', `/api/invites/${target.board.inviteToken}/join`)).status).toBe(200)
  const [archived, moved, deleted] = [
    await addDish(ada, board.id, 'Käsekuchen', ['Cashews']),
    await addDish(ada, board.id, 'Ramen', ['Nudeln']),
    await addDish(ada, board.id, 'Gnocchi', ['Kartoffeln']),
  ]
  for (const dish of [archived, moved, deleted]) await putOn(ada, board.id, dish, ['Zeile'])
  expect((await send(ada, 'PATCH', `/api/dishes/${archived.id}`, { title: 'Veganer Käsekuchen' })).status).toBe(200)
  expect((await listOf(ada, board.id))[0]).toMatchObject({ dishTitle: 'Veganer Käsekuchen', dishOnBoard: true })
  // A rename after the last put-on is shown, but not stored.
  await putOn(ada, board.id, archived, ['Zeile 2'])
  expect((await send(ada, 'PATCH', `/api/dishes/${moved.id}`, { title: 'Miso Ramen' })).status).toBe(200)

  expect((await send(ada, 'DELETE', `/api/dishes/${archived.id}`)).status).toBe(204)
  expect((await send(ada, 'POST', `/api/dishes/${moved.id}/move`, { columnId: target.board.columns[0]!.id })).status).toBe(200)
  expect((await send(ada, 'DELETE', `/api/dishes/${deleted.id}`)).status).toBe(204)
  expect((await send(ada, 'POST', `/api/dishes/${deleted.id}/purge`)).status).toBe(204)

  expect((await listOf(ada, board.id)).map(i => [i.text, i.dishId, i.dishTitle, i.dishOnBoard])).toEqual([
    ['Zeile', archived.id, 'Veganer Käsekuchen', false],
    ['Zeile 2', archived.id, 'Veganer Käsekuchen', false],
    ['Zeile', moved.id, 'Ramen', false],
    ['Zeile', deleted.id, 'Gnocchi', false],
  ])
  expect(await listOf(ada, target.board.id)).toEqual([])
})

test('a Recipe edit, a Copy, archiving and restoring leave the items as they are', async () => {
  const { board, ada } = await freshBoard()
  const other = await freshBoard('Kopie')
  expect((await send(ada, 'POST', `/api/invites/${other.board.inviteToken}/join`)).status).toBe(200)
  const soup = await addDish(ada, board.id, 'Linsensuppe', ['Linsen', 'Tomaten'])
  const items = await putOn(ada, board.id, soup, ['Linsen', 'Tomaten'])
  await change(ada, items[1]!.id, { ticked: true })
  const before = await listOf(ada, board.id)

  expect((await send(ada, 'PATCH', `/api/dishes/${soup.id}`, { recipe: { ingredients: ['Erbsen'], steps: [] } })).status).toBe(200)
  expect((await send(ada, 'POST', `/api/dishes/${soup.id}/copy`, { boardId: other.board.id })).status).toBe(201)
  expect((await send(ada, 'DELETE', `/api/dishes/${soup.id}`)).status).toBe(204)
  expect((await send(ada, 'POST', `/api/dishes/${soup.id}/restore`)).status).toBe(200)

  expect(await listOf(ada, board.id)).toEqual(before)
  expect(await listOf(ada, other.board.id)).toEqual([])
})

test('a Dish without Ingredients, archived, of another Board or missing, and an empty choice, are refused', async () => {
  const { board, ada, grace } = await freshBoard()
  const other = await freshBoard('Woanders')
  const plain = await addDish(ada, board.id, 'Ohne Rezept')
  const archived = await addDish(ada, board.id, 'Archiviert', ['Mehl'])
  const foreign = await addDish(other.ada, other.board.id, 'Fremd', ['Mehl'])
  const withRecipe = await addDish(ada, board.id, 'Mit Rezept', ['Mehl'])
  expect((await send(ada, 'DELETE', `/api/dishes/${archived.id}`)).status).toBe(204)
  const line = () => [{ id: randomUUID(), text: 'Mehl' }]

  expect((await putOnRaw(grace, board.id, { dishId: plain.id, items: line() })).status).toBe(400)
  for (const dishId of [archived.id, foreign.id, randomUUID()]) {
    const res = await putOnRaw(grace, board.id, { dishId, items: line() })
    expect(res.status).toBe(404)
    expect((await res.json() as { statusMessage: string }).statusMessage).toBe('Dish not found')
  }
  expect((await putOnRaw(grace, board.id, { dishId: withRecipe.id, items: [] })).status).toBe(400)
  expect((await putOnRaw(grace, board.id, { dishId: withRecipe.id, items: [{ id: randomUUID(), text: '' }] })).status).toBe(400)
  const twice = randomUUID()
  expect((await putOnRaw(grace, board.id, { dishId: withRecipe.id, items: [{ id: twice, text: 'A' }, { id: twice, text: 'B' }] })).status).toBe(400)

  expect(await listOf(ada, board.id)).toEqual([])
})

// --- Putting a week on (#532) -------------------------------------------------

// A week far ahead, so it counts from its Monday whatever today is.
const LATER = { monday: '2031-06-02', tuesday: '2031-06-03', sunday: '2031-06-08', nextMonday: '2031-06-09', sundayBefore: '2031-06-01' }

test('a week put on adds every Dish planned from its Monday to its Sunday, each once with all its Ingredients, in the order of their first day', async () => {
  const { board, ada, grace } = await freshBoard()
  const [soup, pasta, bowl, before, after] = [
    await addDish(ada, board.id, 'Linsensuppe', ['Linsen', 'Tomaten']),
    await addDish(ada, board.id, 'Pasta', ['Penne']),
    await addDish(ada, board.id, 'Bowl', ['Tofu']),
    await addDish(ada, board.id, 'Davor', ['Früher']),
    await addDish(ada, board.id, 'Danach', ['Später']),
  ]
  await plan(ada, board.id, pasta, LATER.sunday)
  await plan(ada, board.id, soup, LATER.tuesday)
  await plan(ada, board.id, soup, LATER.sunday)
  await plan(ada, board.id, bowl, LATER.monday)
  await plan(ada, board.id, before, LATER.sundayBefore)
  await plan(ada, board.id, after, LATER.nextMonday)

  const res = await weekRaw(grace, board.id, { week: LATER.monday })

  expect(res.status, await res.clone().text()).toBe(200)
  const answer = await res.json() as { dishes: number, items: Item[] }
  expect(answer.dishes).toBe(3)
  expect(answer.items.map(i => i.text)).toEqual(['Tofu', 'Linsen', 'Tomaten', 'Penne'])
  expect((await listOf(ada, board.id)).map(i => [i.dishTitle, i.text])).toEqual([
    ['Bowl', 'Tofu'],
    ['Linsensuppe', 'Linsen'],
    ['Linsensuppe', 'Tomaten'],
    ['Pasta', 'Penne'],
  ])
})

test('a week skips Dishes already on the list, without Ingredients or archived, and answers 0 when nothing is left', async () => {
  const { board, ada } = await freshBoard()
  const [onList, plain, archived, fresh] = [
    await addDish(ada, board.id, 'Schon drauf', ['A']),
    await addDish(ada, board.id, 'Ohne Rezept'),
    await addDish(ada, board.id, 'Archiviert', ['B']),
    await addDish(ada, board.id, 'Neu', ['C']),
  ]
  for (const dish of [onList, plain, archived, fresh]) await plan(ada, board.id, dish, LATER.tuesday)
  await putOn(ada, board.id, onList, ['A'])
  expect((await send(ada, 'DELETE', `/api/dishes/${archived.id}`)).status).toBe(204)
  const watch = await watchEvents()

  expect((await (await weekRaw(ada, board.id, { week: LATER.monday })).json() as { dishes: number }).dishes).toBe(1)
  const version = await versionOf(ada, board.id)
  const again = await weekRaw(ada, board.id, { week: LATER.monday })

  expect(again.status).toBe(200)
  expect(await again.json()).toEqual({ dishes: 0, items: [] })
  expect(await versionOf(ada, board.id)).toBe(version)
  expect(await textsOf(ada, board.id)).toEqual(['A', 'C'])
  expect((await watch.recorded()).filter(e => e.kind === 'week_put_on_shopping_list')).toEqual([
    { kind: 'week_put_on_shopping_list', boardId: board.id, dishId: null, userId: await idOf(ada), details: { week: LATER.monday, dishes: 1 } },
  ])
})

test('a Dish whose group was deleted entirely goes on again with the week', async () => {
  const { board, ada } = await freshBoard()
  const soup = await addDish(ada, board.id, 'Suppe', ['Linsen'])
  await plan(ada, board.id, soup, LATER.tuesday)
  const [line] = await putOn(ada, board.id, soup, ['Linsen'])
  expect((await deleteRaw(ada, line!.id)).status).toBe(204)

  expect((await (await weekRaw(ada, board.id, { week: LATER.monday })).json() as { dishes: number }).dishes).toBe(1)
})

test('a week that is over is refused, and a day that isn\'t a Monday is a bad request', async () => {
  const { board, ada } = await freshBoard()
  const soup = await addDish(ada, board.id, 'Suppe', ['Linsen'])
  await plan(ada, board.id, soup, '2026-01-06')

  const res = await weekRaw(ada, board.id, { week: '2026-01-05' })
  expect(res.status).toBe(400)
  expect((await res.json() as { statusMessage: string }).statusMessage).toBe('That week is over')
  for (const week of [LATER.tuesday, 'nächste Woche', undefined]) expect((await weekRaw(ada, board.id, { week })).status).toBe(400)
  expect(await listOf(ada, board.id)).toEqual([])
})

// The week of Monday 5 January 2026, put on (late) on the day it was made.
// In Berlin that is UTC+1: 23:30 UTC on the 6th is already the 7th there.
test.each([
  ['Tuesday 23:30 in Berlin', '2026-01-06T22:30:00Z', ['Dienstag', 'Mittwoch', 'Sonntag']],
  ['Wednesday 00:30 in Berlin', '2026-01-06T23:30:00Z', ['Mittwoch', 'Sonntag']],
  ['Sunday 23:59 in Berlin', '2026-01-11T22:59:00Z', ['Sonntag']],
])('a week counts from the day it was put on, in Berlin: %s', async (_, madeAt, expected) => {
  const { board, ada } = await freshBoard()
  const days: [string, string][] = [['Montag', '2026-01-05'], ['Dienstag', '2026-01-06'], ['Mittwoch', '2026-01-07'], ['Sonntag', '2026-01-11'], ['Nächster Montag', '2026-01-12']]
  for (const [title, day] of days) await plan(ada, board.id, await addDish(ada, board.id, title, [title]), day)

  const res = await weekRaw(ada, board.id, { week: '2026-01-05', madeAt })

  expect(res.status, await res.clone().text()).toBe(200)
  expect(await textsOf(ada, board.id)).toEqual(expected)
})

test('a week put on on Monday 00:30 in Berlin, after its Sunday, is over', async () => {
  const { board, ada } = await freshBoard()
  await plan(ada, board.id, await addDish(ada, board.id, 'Sonntag', ['Sonntag']), '2026-01-11')
  expect((await weekRaw(ada, board.id, { week: '2026-01-05', madeAt: '2026-01-11T23:30:00Z' })).status).toBe(400)
})

test('a week going over 500 items is refused whole', async () => {
  const { board, ada } = await freshBoard()
  const lines = Array.from({ length: 60 }, (_, i) => `Zeile ${i + 1}`)
  const big = await addDish(ada, board.id, 'Viel', lines)
  for (let i = 0; i < 8; i++) await putOn(ada, board.id, big, lines)
  const small = await addDish(ada, board.id, 'Wenig', Array.from({ length: 21 }, (_, i) => `Klein ${i}`))
  await plan(ada, board.id, small, LATER.tuesday)

  expect((await weekRaw(ada, board.id, { week: LATER.monday })).status).toBe(409)
  expect(await listOf(ada, board.id)).toHaveLength(480)
})

test('the Operator and a Member with no Permissions put a week on', async () => {
  const { board, ada, grace } = await freshBoard()
  const babbage = await operator()
  const soup = await addDish(ada, board.id, 'Suppe', ['Linsen'])
  const pasta = await addDish(ada, board.id, 'Pasta', ['Penne'])
  await plan(ada, board.id, soup, LATER.tuesday)
  await plan(ada, board.id, pasta, LATER.sunday)

  expect((await (await weekRaw(grace, board.id, { week: LATER.monday })).json() as { dishes: number }).dishes).toBe(2)
  await putOn(babbage, board.id, soup, ['Linsen'])
  expect(await textsOf(ada, board.id)).toEqual(['Linsen', 'Linsen', 'Penne'])
})

// --- Changes that arrive late (#533; ADR 0012) --------------------------------

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

test('each write applies when it arrives late, with the time it was made', async () => {
  const { board, ada, grace } = await freshBoard()
  const soup = await addDish(ada, board.id, 'Suppe', ['Linsen'])
  await plan(ada, board.id, soup, LATER.tuesday)
  const madeAt = minutesAgo(90)
  const id = randomUUID()

  expect((await addRaw(grace, board.id, { id, text: 'Hafermilch', madeAt })).status).toBe(201)
  expect((await changeRaw(grace, id, { text: '2 Hafermilch', madeAt })).status).toBe(200)
  expect((await changeRaw(grace, id, { ticked: true, madeAt })).status).toBe(200)
  expect((await clearRaw(grace, board.id, { madeAt })).status).toBe(200)
  expect((await restoreRaw(grace, board.id, [id])).status).toBe(200)
  expect((await deleteRaw(grace, id, { madeAt })).status).toBe(204)
  expect((await putOnRaw(grace, board.id, { dishId: soup.id, items: [{ id: randomUUID(), text: 'Linsen' }], madeAt })).status).toBe(201)
  expect((await weekRaw(grace, board.id, { week: LATER.monday, madeAt })).status).toBe(200)

  expect(await textsOf(ada, board.id)).toEqual(['Linsen'])
  for (const res of [
    await addRaw(grace, board.id, { id: randomUUID(), text: 'A', madeAt: 'gestern' }),
    await deleteRaw(grace, id, { madeAt: 'gestern' }),
    await clearRaw(grace, board.id, { madeAt: 'gestern' }),
    await putOnRaw(grace, board.id, { dishId: soup.id, items: [{ id: randomUUID(), text: 'Linsen' }], madeAt: 'gestern' }),
    await weekRaw(grace, board.id, { week: LATER.monday, madeAt: 'gestern' }),
  ]) expect(res.status).toBe(400)
})

test('a late tick or text change wins over one made meanwhile: the last one to arrive counts', async () => {
  const { board, ada, grace } = await freshBoard()
  const item = await add(ada, board.id, 'Hafermilch')
  const madeAt = minutesAgo(30)
  await change(ada, item.id, { text: 'Sojamilch' })
  await change(ada, item.id, { ticked: true })

  await change(grace, item.id, { text: 'Hafermilch, 2 Packungen', madeAt })
  await change(grace, item.id, { ticked: false, madeAt })

  expect(await listOf(ada, board.id)).toEqual([expect.objectContaining({ text: 'Hafermilch, 2 Packungen', ticked: false })])
})

test('a late change, tick or delete of an item deleted or cleared meanwhile is dropped with "Shopping Item not found"', async () => {
  const { board, ada, grace } = await freshBoard()
  const [deleted, cleared] = [await add(ada, board.id, 'Weg'), await add(ada, board.id, 'Erledigt')]
  expect((await deleteRaw(ada, deleted.id)).status).toBe(204)
  await change(ada, cleared.id, { ticked: true })
  expect((await clearRaw(ada, board.id)).status).toBe(200)
  const madeAt = minutesAgo(10)

  for (const id of [deleted.id, cleared.id, randomUUID()]) {
    for (const res of [
      await changeRaw(grace, id, { text: 'Neu', madeAt }),
      await changeRaw(grace, id, { ticked: false, madeAt }),
      await deleteRaw(grace, id, { madeAt }),
    ]) {
      expect(res.status).toBe(404)
      expect((await res.json() as { statusMessage: string }).statusMessage).toBe('Shopping Item not found')
    }
  }
  expect(await listOf(ada, board.id)).toEqual([])
})

test('a late put-on of a Dish archived, deleted for good or moved meanwhile is dropped with "Dish not found"', async () => {
  const { board, ada, grace } = await freshBoard()
  const target = await freshBoard('Ziel')
  expect((await send(ada, 'POST', `/api/invites/${target.board.inviteToken}/join`)).status).toBe(200)
  const [archived, purged, moved] = [
    await addDish(ada, board.id, 'A', ['a']),
    await addDish(ada, board.id, 'B', ['b']),
    await addDish(ada, board.id, 'C', ['c']),
  ]
  expect((await send(ada, 'DELETE', `/api/dishes/${archived.id}`)).status).toBe(204)
  expect((await send(ada, 'DELETE', `/api/dishes/${purged.id}`)).status).toBe(204)
  expect((await send(ada, 'POST', `/api/dishes/${purged.id}/purge`)).status).toBe(204)
  expect((await send(ada, 'POST', `/api/dishes/${moved.id}/move`, { columnId: target.board.columns[0]!.id })).status).toBe(200)

  for (const dish of [archived, purged, moved]) {
    const res = await putOnRaw(grace, board.id, { dishId: dish.id, items: [{ id: randomUUID(), text: 'x' }], madeAt: minutesAgo(5) })
    expect(res.status).toBe(404)
    expect((await res.json() as { statusMessage: string }).statusMessage).toBe('Dish not found')
  }
  expect(await listOf(ada, board.id)).toEqual([])
})

test('a late week collects its Dishes as the Board is when it arrives', async () => {
  const { board, ada, grace } = await freshBoard()
  const [planned, laterPlanned] = [await addDish(ada, board.id, 'Früh', ['früh']), await addDish(ada, board.id, 'Spät', ['spät'])]
  await plan(ada, board.id, planned, LATER.tuesday)
  const madeAt = minutesAgo(20)
  // Planned after the week was put on offline, before it arrived.
  await plan(ada, board.id, laterPlanned, LATER.sunday)

  expect((await (await weekRaw(grace, board.id, { week: LATER.monday, madeAt })).json() as { dishes: number }).dishes).toBe(2)
})

test('the same add or put-on sent twice applies once; both answer 201, with one event', async () => {
  const { board, ada, grace } = await freshBoard()
  const soup = await addDish(ada, board.id, 'Suppe', ['Linsen', 'Tomaten'])
  const add = { id: randomUUID(), text: 'Hafermilch', madeAt: minutesAgo(5) }
  const put = { dishId: soup.id, items: [{ id: randomUUID(), text: 'Linsen' }, { id: randomUUID(), text: 'Tomaten' }], madeAt: minutesAgo(5) }
  const watch = await watchEvents()

  const [first, second] = await Promise.all([addRaw(grace, board.id, add), addRaw(grace, board.id, add)])
  const [put1, put2] = [await putOnRaw(grace, board.id, put), await putOnRaw(grace, board.id, put)]

  for (const res of [first, second, put1, put2]) expect(res.status).toBe(201)
  expect(await put2.json()).toEqual(await put1.json())
  expect(await textsOf(ada, board.id)).toEqual(['Hafermilch', 'Linsen', 'Tomaten'])
  expect((await watch.recorded()).map(e => e.kind)).toEqual(['shopping_item_added', 'dish_put_on_shopping_list'])
})

test('an id another user\'s item has, or another Board\'s, is refused with 409 and adds nothing', async () => {
  const { board, ada, grace } = await freshBoard()
  const taken = await add(ada, board.id, 'Hafermilch')
  const soup = await addDish(ada, board.id, 'Suppe', ['Linsen'])

  expect((await addRaw(grace, board.id, { id: taken.id, text: 'Klopapier' })).status).toBe(409)
  expect((await putOnRaw(grace, board.id, { dishId: soup.id, items: [{ id: taken.id, text: 'Linsen' }] })).status).toBe(409)
  expect(await textsOf(ada, board.id)).toEqual(['Hafermilch'])
})
