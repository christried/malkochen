import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// The Caption (CONTEXT.md, #393): the text a Source shows with its post, kept
// with the Dish when it is added, read again when the Source changes, shown
// with the Dish and found by search.

interface Dish {
  id: string
  title: string
  creator: string | null
  caption: string | null
  source: { link: string, kind: string } | null
}
interface Board {
  id: string
  columns: { dishes: Dish[] }[]
}

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const SHORT = 'https://www.youtube.com/shorts/tPEE9ZwTmy0'
const CAPTION = 'Zitronenthymian und Kichererbsen, dazu Tahini.\nAlles in einer Pfanne.'

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

async function addDish(caller: Caller, body: Record<string, unknown>): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title: 'Dal', placeholder: 'bowl', ...body })
  expect(res.status).toBe(201)
  const { placement: _, ...dish } = await res.json() as Dish & { placement: unknown }
  return dish
}

function editDish(caller: Caller, dishId: string, body: unknown) {
  return caller.fetch(`/api/dishes/${dishId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function onBoard(caller: Caller, dishId: string): Promise<Dish | undefined> {
  return (await landingBoard(caller)).columns.flatMap(c => c.dishes).find(d => d.id === dishId)
}

async function searchIds(caller: Caller, q: string): Promise<string[]> {
  const board = await landingBoard(caller)
  const res = await caller.fetch(`/api/boards/${board.id}/dishes?q=${encodeURIComponent(q)}`)
  expect(res.status).toBe(200)
  return ((await res.json()) as { dishes: Dish[] }).dishes.map(d => d.id)
}

test('a Dish added with its Source keeps the Caption, and the Board shows it', async () => {
  const ada = await signIn(ALLOWLISTED[0])

  const added = await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION })

  expect(added.caption).toBe(CAPTION)
  expect(await onBoard(ada, added.id)).toEqual(added)
})

test('a Dish added without a Caption, or without a Source, has none', async () => {
  const ada = await signIn(ALLOWLISTED[0])

  expect((await addDish(ada, { source: { link: TIKTOK } })).caption).toBeNull()
  expect((await addDish(ada, { caption: CAPTION })).caption).toBeNull()
  expect((await addDish(ada, { source: { link: TIKTOK }, caption: '   ' })).caption).toBeNull()
})

test('changing the Source reads the Caption again from the new Source', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION })

  const changed = await (await editDish(ada, dish.id, { source: { link: SHORT }, caption: 'Vom Kurzvideo.' })).json()

  expect(changed).toMatchObject({ source: { link: SHORT, kind: 'youtube-short' }, caption: 'Vom Kurzvideo.' })
  expect(await onBoard(ada, dish.id)).toEqual(changed)
})

test('a Source without a Caption, or a removed Source, leaves none', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION })

  expect((await (await editDish(ada, dish.id, { source: { link: SHORT } })).json()).caption).toBeNull()
  expect((await (await editDish(ada, dish.id, { source: { link: TIKTOK }, caption: CAPTION })).json()).caption).toBe(CAPTION)
  expect((await (await editDish(ada, dish.id, { source: null })).json()).caption).toBeNull()
})

test('editing other fields leaves the Caption as it is', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION })

  const edited = await (await editDish(ada, dish.id, { title: 'Linsen-Dal' })).json()

  expect(edited.caption).toBe(CAPTION)
})

test('search finds a Dish by its Caption, and by its Creator, but not by a word in neither', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { title: 'Eintopf', source: { link: TIKTOK }, creator: 'Suki Küche', caption: CAPTION })

  expect(await searchIds(ada, 'zitronenthymian')).toContain(dish.id)
  expect(await searchIds(ada, 'suki küche')).toContain(dish.id)
  expect(await searchIds(ada, 'Eintopf')).toContain(dish.id)
  expect(await searchIds(ada, 'Kartoffelsalat mit Speck')).not.toContain(dish.id)
})
