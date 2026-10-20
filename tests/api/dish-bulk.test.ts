import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Moving or deleting several Dishes at once (#218): POST /api/dishes/bulk
// moves Dishes to the top of a Column, puts them back where they were
// (undo of a move), deletes them, or restores them (undo of a delete), all
// in one step, all or nothing. Rosalind is used by this file only; Chien-
// Shiung is the non-Member.

interface Dish {
  id: string
  title: string
  creator: string | null
  source: { link: string, kind: string } | null
  cookings: unknown[]
}
interface Board {
  id: string
  columns: { id: string, name: string, isGekocht: boolean, dishes: Dish[] }[]
}

const ROSALIND = ALLOWLISTED[22]
const OUTSIDER = ALLOWLISTED[23]

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

async function board(caller: Caller, boardId: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${boardId}`)).json()
}

// To the landing Board, unless `boardId` says which.
async function addDish(caller: Caller, title: string, extra: Record<string, unknown> = {}, boardId?: string): Promise<Dish> {
  const res = await postDish(caller, boardId ?? (await landingBoard(caller)).id, { title, placeholder: 'bowl', ...extra })
  expect(res.status).toBe(201)
  return res.json()
}

function bulk(caller: Caller, body: unknown) {
  return caller.fetch('/api/dishes/bulk', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function moveDish(caller: Caller, dishId: string, columnId: string) {
  return caller.fetch(`/api/dishes/${dishId}/move`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ columnId }),
  })
}

// The Dish ids of each Column of a Board, in Board order.
async function columnIds(caller: Caller, boardId: string): Promise<string[][]> {
  return (await board(caller, boardId)).columns.map(c => c.dishes.map(d => d.id))
}

async function createBoard(caller: Caller, name: string): Promise<Board> {
  const res = await caller.fetch('/api/boards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, emoji: '🥕' }),
  })
  expect(res.status).toBe(201)
  return board(caller, (await res.json() as { id: string }).id)
}

test('Dishes from several Columns move to the top of a Column together, in the order sent', async () => {
  const rosalind = await signIn(ROSALIND)
  const { id: boardId, columns: [, dieseWoche] } = await landingBoard(rosalind)
  const waiting = await addDish(rosalind, 'Ramen')
  await moveDish(rosalind, waiting.id, dieseWoche!.id)
  const first = await addDish(rosalind, 'Gnocchi')
  const second = await addDish(rosalind, 'Dal')
  const third = await addDish(rosalind, 'Pho')
  // One from the Gekocht Column too.
  const gekocht = (await landingBoard(rosalind)).columns.find(c => c.isGekocht)!
  await moveDish(rosalind, third.id, gekocht.id)

  const res = await bulk(rosalind, { action: 'move', dishIds: [second.id, first.id, third.id], columnId: dieseWoche!.id })

  expect(res.status).toBe(200)
  const moved = await res.json() as (Dish & { placement: { boardId: string, columnId: string, index: number } })[]
  expect(moved.map(d => [d.id, d.placement])).toEqual([
    [second.id, { boardId, columnId: dieseWoche!.id, index: 0 }],
    [first.id, { boardId, columnId: dieseWoche!.id, index: 1 }],
    [third.id, { boardId, columnId: dieseWoche!.id, index: 2 }],
  ])
  const after = await board(rosalind, boardId)
  expect(after.columns[1]!.dishes.map(d => d.id).slice(0, 4)).toEqual([second.id, first.id, third.id, waiting.id])
  expect(after.columns[0]!.dishes.map(d => d.id)).not.toContain(first.id)
  // Leaving the Gekocht Column, a Dish keeps its Cooking History.
  expect(after.columns[1]!.dishes.find(d => d.id === third.id)!.cookings).toHaveLength(1)
})

test('a Dish already in the target Column stays where it is', async () => {
  const rosalind = await signIn(ROSALIND)
  const { id: boardId, columns: [, dieseWoche] } = await landingBoard(rosalind)
  const before = await columnIds(rosalind, boardId)
  const staying = before[1]!.at(-1)!
  const coming = await addDish(rosalind, 'Kimchi')

  expect((await bulk(rosalind, { action: 'move', dishIds: [staying, coming.id], columnId: dieseWoche!.id })).status).toBe(200)

  const after = (await columnIds(rosalind, boardId))[1]!
  expect(after[0]).toBe(coming.id)
  expect(after.at(-1)).toBe(staying)
})

test('Dishes move to a Column on another of the user’s Boards', async () => {
  const rosalind = await signIn(ROSALIND)
  const home = await landingBoard(rosalind)
  const other = await createBoard(rosalind, 'Sommerküche')
  const a = await addDish(rosalind, 'Gazpacho')
  const b = await addDish(rosalind, 'Melonensalat')

  const res = await bulk(rosalind, { action: 'move', dishIds: [b.id, a.id], columnId: other.columns[0]!.id })

  expect(res.status).toBe(200)
  expect((await columnIds(rosalind, other.id))[0]).toEqual([b.id, a.id])
  expect((await columnIds(rosalind, home.id)).flat()).not.toContain(a.id)
})

test('several Dishes can’t be moved into a Gekocht Column: cooking stays one Dish at a time', async () => {
  const rosalind = await signIn(ROSALIND)
  const { id: boardId, columns } = await landingBoard(rosalind)
  const a = await addDish(rosalind, 'Linsencurry')
  const b = await addDish(rosalind, 'Couscous')
  const before = await columnIds(rosalind, boardId)

  const res = await bulk(rosalind, { action: 'move', dishIds: [a.id, b.id], columnId: columns.find(c => c.isGekocht)!.id })

  expect(res.status).toBe(400)
  expect(await columnIds(rosalind, boardId)).toEqual(before)
})

test('one Dish the user may not move, and none of them moves', async () => {
  const rosalind = await signIn(ROSALIND)
  const outsider = await signIn(OUTSIDER)
  const { id: boardId, columns: [, dieseWoche] } = await landingBoard(rosalind)
  const mine = await addDish(rosalind, 'Bohnensuppe')
  const theirs = await addDish(outsider, 'Fremdes Curry')
  const deleted = await addDish(rosalind, 'Gelöschtes Chili')
  await rosalind.fetch(`/api/dishes/${deleted.id}`, { method: 'DELETE' })
  const before = await columnIds(rosalind, boardId)

  for (const other of [theirs.id, deleted.id, '00000000-0000-4000-8000-000000000000']) {
    expect((await bulk(rosalind, { action: 'move', dishIds: [mine.id, other], columnId: dieseWoche!.id })).status).toBe(404)
  }

  expect(await columnIds(rosalind, boardId)).toEqual(before)
  expect((await columnIds(outsider, (await landingBoard(outsider)).id)).flat()).toContain(theirs.id)
})

test('Dishes can’t be moved to a Board the user isn’t a Member of', async () => {
  const rosalind = await signIn(ROSALIND)
  const outsider = await signIn(OUTSIDER)
  const { id: boardId } = await landingBoard(rosalind)
  const a = await addDish(rosalind, 'Shakshuka')
  const elsewhere = await landingBoard(outsider)
  const before = await columnIds(rosalind, boardId)
  const elsewhereBefore = await columnIds(outsider, elsewhere.id)

  const res = await bulk(rosalind, { action: 'move', dishIds: [a.id], columnId: elsewhere.columns[1]!.id })

  expect(res.status).toBe(400)
  expect(await columnIds(rosalind, boardId)).toEqual(before)
  expect(await columnIds(outsider, elsewhere.id)).toEqual(elsewhereBefore)
})

test('undo of a move puts every Dish back in its Board, its Column and its place', async () => {
  const rosalind = await signIn(ROSALIND)
  const other = await createBoard(rosalind, 'Wintervorrat')
  const home = await createBoard(rosalind, 'Winterküche')
  for (const title of ['Rotkohl', 'Klöße', 'Maronen', 'Linsen', 'Kürbis']) await addDish(rosalind, title, {}, home.id)
  await moveDish(rosalind, (await columnIds(rosalind, home.id))[0]![0]!, home.columns[1]!.id)
  const before = await columnIds(rosalind, home.id)
  // The second and fourth of Ideen, and the first of Diese Woche.
  const picked = [
    { dishId: before[0]![1]!, columnId: home.columns[0]!.id, index: 1 },
    { dishId: before[0]![3]!, columnId: home.columns[0]!.id, index: 3 },
    { dishId: before[1]![0]!, columnId: home.columns[1]!.id, index: 0 },
  ]
  const res = await bulk(rosalind, { action: 'move', dishIds: picked.map(p => p.dishId), columnId: other.columns[1]!.id })
  expect(res.status).toBe(200)

  const back = await bulk(rosalind, { action: 'place', places: picked })

  expect(back.status).toBe(200)
  const placed = await back.json() as { id: string, placement: unknown }[]
  expect(placed.map(d => [d.id, d.placement])).toEqual(picked.map(p => [p.dishId, { boardId: home.id, columnId: p.columnId, index: p.index }]))
  expect(await columnIds(rosalind, home.id)).toEqual(before)
  expect((await columnIds(rosalind, other.id))[1]).toEqual([])
})

test('putting Dishes back is all or nothing, and only onto the user’s Boards', async () => {
  const rosalind = await signIn(ROSALIND)
  const outsider = await signIn(OUTSIDER)
  const { id: boardId, columns: [ideen] } = await landingBoard(rosalind)
  const a = await addDish(rosalind, 'Polenta')
  const theirs = await addDish(outsider, 'Fremde Polenta')
  const elsewhere = await landingBoard(outsider)
  const before = await columnIds(rosalind, boardId)

  expect((await bulk(rosalind, { action: 'place', places: [
    { dishId: a.id, columnId: ideen!.id, index: 3 },
    { dishId: theirs.id, columnId: ideen!.id, index: 0 },
  ] })).status).toBe(404)
  expect((await bulk(rosalind, { action: 'place', places: [
    { dishId: a.id, columnId: elsewhere.columns[0]!.id, index: 0 },
  ] })).status).toBe(400)

  expect(await columnIds(rosalind, boardId)).toEqual(before)
  expect((await columnIds(outsider, elsewhere.id)).flat()).not.toContain(a.id)
})

test('putting back can take a Cooked Dish into its Gekocht Column, but never makes a Dish Cooked', async () => {
  const rosalind = await signIn(ROSALIND)
  const home = await createBoard(rosalind, 'Erntedank')
  const gekocht = home.columns.find(c => c.isGekocht)!
  const cooked = await addDish(rosalind, 'Apfelstrudel', {}, home.id)
  await moveDish(rosalind, cooked.id, gekocht.id)
  const raw = await addDish(rosalind, 'Rohkost', {}, home.id)
  expect((await bulk(rosalind, { action: 'move', dishIds: [cooked.id], columnId: home.columns[1]!.id })).status).toBe(200)

  expect((await bulk(rosalind, { action: 'place', places: [
    { dishId: cooked.id, columnId: gekocht.id, index: 0 },
    { dishId: raw.id, columnId: gekocht.id, index: 1 },
  ] })).status).toBe(400)
  expect((await columnIds(rosalind, home.id))[2]).toEqual([])

  expect((await bulk(rosalind, { action: 'place', places: [{ dishId: cooked.id, columnId: gekocht.id, index: 0 }] })).status).toBe(200)
  const after = await board(rosalind, home.id)
  expect(after.columns[2]!.dishes.map(d => [d.id, d.cookings.length])).toEqual([[cooked.id, 1]])
})

test('deleted together, Dishes come back together, where they were and as they were', async () => {
  const rosalind = await signIn(ROSALIND)
  const { id: boardId } = await landingBoard(rosalind)
  const a = await addDish(rosalind, 'Pilzrisotto', {
    creator: '@christried',
    source: { link: 'https://www.example.com/pilzrisotto', kind: 'blog' },
  })
  await addDish(rosalind, 'Zwischendrin')
  const b = await addDish(rosalind, 'Spargel')
  const before = await board(rosalind, boardId)

  const res = await bulk(rosalind, { action: 'delete', dishIds: [a.id, b.id] })

  expect(res.status).toBe(204)
  const gone = (await columnIds(rosalind, boardId)).flat()
  expect(gone).not.toContain(a.id)
  expect(gone).not.toContain(b.id)

  const restored = await bulk(rosalind, { action: 'restore', dishIds: [a.id, b.id] })

  expect(restored.status).toBe(200)
  expect((await restored.json() as { id: string }[]).map(d => d.id)).toEqual([a.id, b.id])
  const after = await board(rosalind, boardId)
  expect(after.columns.map(c => c.dishes.map(d => d.id))).toEqual(before.columns.map(c => c.dishes.map(d => d.id)))
  expect(after.columns[0]!.dishes.find(d => d.id === a.id)).toMatchObject({
    creator: '@christried',
    source: { link: 'https://www.example.com/pilzrisotto', kind: 'blog' },
  })
})

test('deleting is all or nothing, and only Dishes on the user’s Boards', async () => {
  const rosalind = await signIn(ROSALIND)
  const outsider = await signIn(OUTSIDER)
  const { id: boardId } = await landingBoard(rosalind)
  const mine = await addDish(rosalind, 'Tofu-Bowl')
  const theirs = await addDish(outsider, 'Fremde Bowl')
  const before = await columnIds(rosalind, boardId)

  expect((await bulk(rosalind, { action: 'delete', dishIds: [mine.id, theirs.id] })).status).toBe(404)
  expect((await bulk(outsider, { action: 'restore', dishIds: [mine.id] })).status).toBe(404)

  expect(await columnIds(rosalind, boardId)).toEqual(before)
  expect((await columnIds(outsider, (await landingBoard(outsider)).id)).flat()).toContain(theirs.id)
})

test('a bulk request names its action and at least one Dish, each by id, each once', async () => {
  const rosalind = await signIn(ROSALIND)
  const { columns: [ideen] } = await landingBoard(rosalind)
  const a = await addDish(rosalind, 'Hummus')

  for (const body of [
    { action: 'move', dishIds: [], columnId: ideen!.id },
    { action: 'move', dishIds: ['not-a-dish'], columnId: ideen!.id },
    { action: 'move', dishIds: [a.id, a.id], columnId: ideen!.id },
    { action: 'move', dishIds: [a.id] },
    { action: 'cook', dishIds: [a.id] },
    { action: 'delete' },
    { action: 'place', places: [{ dishId: a.id, columnId: ideen!.id, index: -1 }] },
    { dishIds: [a.id] },
  ]) {
    expect((await bulk(rosalind, body)).status, JSON.stringify(body)).toBe(400)
  }
})
