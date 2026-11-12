import { afterAll, beforeAll, expect, test } from 'vitest'
import type { AdminEventPage } from '../../shared/admin'
import type { Recipe } from '../../shared/recipe'
import type { AdminRecipeFinderUser } from '../../shared/recipe-finder'
import { startResendService, type ResendService } from '../support/resend-service'
import { BLOG, BLOG_RECIPE, LONG_RECIPE_BLOG, RECIPE_BLOG, SLOW_RECIPE_BLOG, UNREADABLE_BLOG } from '../support/source-lookup-fixtures'
import { OPERATOR } from '../support/test-auth-env'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { databaseRows, endLimitWindow, useUpLimit } from './time-travel'

// "Rezept finden" (#500): a user whose Recipe Finder is on searches a Dish
// with a Source and no Recipe, and the Recipe the Source's page carries
// becomes the Dish's. The users below are used by this file only.

const user = (name: string) => ALLOWLISTED[ALLOWLISTED.indexOf(`${name}@example.com` as typeof ALLOWLISTED[number])]!
const STROUSTRUP = user('stroustrup')
const HEJLSBERG = user('hejlsberg')
const MATSUMOTO = user('matsumoto')
const ROSSUM = user('rossum')
const GOSLING = user('gosling')
const KERNIGHAN = user('kernighan')
const PIKE = user('pike')
const WALL = user('wall')

interface Dish {
  id: string
  title: string
  source: { link: string, kind: string } | null
  recipe: Recipe | null
  recipeSearch: 'looking' | 'none' | null
}

interface Board {
  id: string
  inviteToken: string
  version: number
  members: { id: string, name: string }[]
  columns: { id: string, dishes: Dish[] }[]
}

interface SearchAnswer {
  outcome: 'found' | 'none' | 'failed'
  dish: Dish
}

let resend: ResendService

beforeAll(async () => {
  resend = await startResendService()
  const operator = await signIn(OPERATOR)
  for (const email of [STROUSTRUP, GOSLING, KERNIGHAN, PIKE, WALL]) {
    expect((await setRecipeFinder(operator, await idOf(await signIn(email)), true)).status).toBe(200)
  }
})

afterAll(() => resend.close())

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, body === undefined ? { method } : json(method, body))

const setRecipeFinder = (operator: Caller, userId: string, on: boolean) => send(operator, 'PUT', `/api/admin/recipe-finder/${userId}`, { on })

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

async function boardOf(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

// A new Board of `owner`'s that `joiners` have joined.
async function newBoard(owner: Caller, ...joiners: Caller[]): Promise<Board> {
  const res = await send(owner, 'POST', '/api/boards', { name: 'Rezepte', emoji: '🍲' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const board = await boardOf(owner, id)
  for (const joiner of joiners) expect((await send(joiner, 'POST', `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  return board
}

// A Dish added with `link` as its Source, if one is given.
async function addDish(caller: Caller, boardId: string, title: string, link?: string): Promise<string> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl', ...link ? { source: { link, kind: 'blog' } } : {} })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

const dishIn = (board: Board, id: string): Dish => board.columns.flatMap(c => c.dishes).find(d => d.id === id)!

const search = (caller: Caller, dishId: string) => caller.fetch(`/api/dishes/${dishId}/recipe-search`, { method: 'POST' })

async function searched(caller: Caller, dishId: string): Promise<SearchAnswer> {
  const res = await search(caller, dishId)
  expect(res.status).toBe(200)
  return res.json()
}

async function refusedWith(res: Response, status: number, reason: string): Promise<void> {
  expect(res.status).toBe(status)
  expect((await res.json()).data?.reason).toBe(reason)
}

// The searches the user's daily cap counted (0 with no row).
async function callsOf(userId: string): Promise<number> {
  const rows = await databaseRows<{ calls: number }>(`select calls from rate_limit_use where limited = 'recipe-search' and user_id = $1`, [userId])
  return rows[0]?.calls ?? 0
}

test('a found Recipe becomes the Dish\'s, seen by every Member, and only "found" is recorded', async () => {
  const owner = await signIn(STROUSTRUP)
  const reader = await signIn(HEJLSBERG)
  const board = await newBoard(owner, reader)
  const dishId = await addDish(owner, board.id, 'Kichererbsen-Curry', RECIPE_BLOG)
  const versionBefore = (await boardOf(owner, board.id)).version
  const events = await watchEvents()

  const answer = await searched(owner, dishId)
  expect(answer.outcome).toBe('found')
  expect(answer.dish.recipe).toEqual({ ...BLOG_RECIPE, link: null })
  expect(answer.dish.recipeSearch).toBeNull()

  const after = await boardOf(reader, board.id)
  expect(after.version).toBeGreaterThan(versionBefore)
  expect(dishIn(after, dishId).recipe).toEqual({ ...BLOG_RECIPE, link: null })
  expect(await events.recorded()).toEqual([
    { kind: 'recipe_found', boardId: board.id, dishId, userId: await idOf(owner), details: null },
  ])
})

test('without the Recipe Finder on, a search is refused, whether off or only asked', async () => {
  const off = await signIn(MATSUMOTO)
  const offBoard = await newBoard(off)
  const offDish = await addDish(off, offBoard.id, 'Ohne Zugang', RECIPE_BLOG)
  await refusedWith(await search(off, offDish), 403, 'recipe-finder-off')

  const asked = await signIn(ROSSUM)
  const askedBoard = await newBoard(asked)
  const askedDish = await addDish(asked, askedBoard.id, 'Angefragt', RECIPE_BLOG)
  expect((await asked.fetch('/api/me/recipe-finder', { method: 'POST' })).status).toBe(200)
  await refusedWith(await search(asked, askedDish), 403, 'recipe-finder-off')

  for (const [caller, board, dishId] of [[off, offBoard, offDish], [asked, askedBoard, askedDish]] as const) {
    expect(dishIn(await boardOf(caller, board.id), dishId)).toMatchObject({ recipe: null, recipeSearch: null })
  }
})

test('a Member searches with "edit Dishes" only, or a Dish they added themselves', async () => {
  const owner = await signIn(STROUSTRUP)
  const gosling = await signIn(GOSLING)
  const board = await newBoard(owner, gosling)
  const goslingId = await idOf(gosling)
  expect((await send(owner, 'PATCH', `/api/boards/${board.id}/members/${goslingId}/permissions`, { editDishes: false })).status).toBe(200)
  const ownDish = await addDish(gosling, board.id, 'Eigenes Gericht', RECIPE_BLOG)
  const ownersDish = await addDish(owner, board.id, 'Gericht des Besitzers', RECIPE_BLOG)

  expect((await searched(gosling, ownDish)).outcome).toBe('found')
  expect((await search(gosling, ownersDish)).status).toBe(403)

  expect((await send(owner, 'PATCH', `/api/boards/${board.id}/members/${goslingId}/permissions`, { editDishes: true })).status).toBe(200)
  expect((await searched(gosling, ownersDish)).outcome).toBe('found')
})

test('a user who is no Member gets "not found", a signed-out one "unauthorized", and an archived Dish is not found', async () => {
  const owner = await signIn(STROUSTRUP)
  const board = await newBoard(owner)
  const dishId = await addDish(owner, board.id, 'Nicht für alle', RECIPE_BLOG)

  expect((await search(await signIn(KERNIGHAN), dishId)).status).toBe(404)
  expect((await search(anonymous(), dishId)).status).toBe(401)

  expect((await send(owner, 'DELETE', `/api/dishes/${dishId}`)).ok).toBe(true)
  expect((await search(owner, dishId)).status).toBe(404)
})

test('a Dish without a Source, or with a Recipe already, is refused and keeps what it has', async () => {
  const owner = await signIn(STROUSTRUP)
  const board = await newBoard(owner)
  const plain = await addDish(owner, board.id, 'Ohne Quelle')
  await refusedWith(await search(owner, plain), 409, 'no-source')

  const typed = await addDish(owner, board.id, 'Mit Rezept', RECIPE_BLOG)
  expect((await send(owner, 'PATCH', `/api/dishes/${typed}`, { recipe: { ingredients: [], steps: ['Umrühren.'] } })).status).toBe(200)
  await refusedWith(await search(owner, typed), 409, 'has-recipe')
  expect(dishIn(await boardOf(owner, board.id), typed).recipe).toEqual({ ingredients: [], steps: ['Umrühren.'], link: null })
})

test('a Recipe a Member types while the search runs is kept over what the search found', async () => {
  const owner = await signIn(STROUSTRUP)
  const board = await newBoard(owner)
  const dishId = await addDish(owner, board.id, 'Langsam', SLOW_RECIPE_BLOG)

  const running = searched(owner, dishId)
  await new Promise(resolve => setTimeout(resolve, 300))
  expect(dishIn(await boardOf(owner, board.id), dishId).recipeSearch).toBe('looking')
  await refusedWith(await search(owner, dishId), 409, 'looking')
  expect((await send(owner, 'PATCH', `/api/dishes/${dishId}`, { recipe: { ingredients: ['Selbst getippt'], steps: [] } })).status).toBe(200)

  const answer = await running
  expect(answer.dish.recipe).toEqual({ ingredients: ['Selbst getippt'], steps: [], link: null })
  expect(answer.dish.recipeSearch).toBeNull()
  expect(dishIn(await boardOf(owner, board.id), dishId)).toMatchObject({ recipe: { ingredients: ['Selbst getippt'], steps: [], link: null }, recipeSearch: null })
})

test('a Source with no Recipe is searched once, until its Source changes', async () => {
  const owner = await signIn(STROUSTRUP)
  const reader = await signIn(HEJLSBERG)
  const board = await newBoard(owner, reader)
  const dishId = await addDish(owner, board.id, 'Ohne Rezept', BLOG)
  const events = await watchEvents()

  const answer = await searched(owner, dishId)
  expect(answer.outcome).toBe('none')
  expect(answer.dish).toMatchObject({ recipe: null, recipeSearch: 'none' })
  expect(dishIn(await boardOf(reader, board.id), dishId).recipeSearch).toBe('none')
  expect(await events.recorded()).toEqual([
    { kind: 'recipe_not_found', boardId: board.id, dishId, userId: await idOf(owner), details: null },
  ])
  await refusedWith(await search(owner, dishId), 409, 'nothing-found')

  // A title change is no new Source: still not searched.
  expect((await send(owner, 'PATCH', `/api/dishes/${dishId}`, { title: 'Umbenannt' })).status).toBe(200)
  expect(dishIn(await boardOf(owner, board.id), dishId).recipeSearch).toBe('none')

  // A new Source is searched afresh.
  expect((await send(owner, 'PATCH', `/api/dishes/${dishId}`, { source: { link: RECIPE_BLOG, kind: 'blog' } })).status).toBe(200)
  expect(dishIn(await boardOf(owner, board.id), dishId).recipeSearch).toBeNull()
  expect((await searched(owner, dishId)).outcome).toBe('found')
})

test('a page that can\'t be read fails the search, which is free and can be repeated', async () => {
  const kernighan = await signIn(KERNIGHAN)
  const kernighanId = await idOf(kernighan)
  const board = await newBoard(kernighan)
  const dishId = await addDish(kernighan, board.id, 'Nicht erreichbar', UNREADABLE_BLOG)
  const events = await watchEvents()

  const first = await searched(kernighan, dishId)
  expect(first).toMatchObject({ outcome: 'failed', dish: { recipe: null, recipeSearch: null } })
  expect((await searched(kernighan, dishId)).outcome).toBe('failed')

  const failedEvent = { kind: 'recipe_search_failed', boardId: board.id, dishId, userId: kernighanId, details: null }
  expect(await events.recorded()).toEqual([failedEvent, failedEvent])
  expect(await callsOf(kernighanId)).toBe(0)
})

test('the daily cap refuses searches past 30 a day, and the window ending lets them through again', async () => {
  const pike = await signIn(PIKE)
  const pikeId = await idOf(pike)
  const board = await newBoard(pike)
  const first = await addDish(pike, board.id, 'Erste Suche', RECIPE_BLOG)
  expect((await searched(pike, first)).outcome).toBe('found')
  expect(await callsOf(pikeId)).toBe(1)

  await useUpLimit(PIKE, 'recipe-search', 30)
  const capped = await addDish(pike, board.id, 'Über dem Limit', RECIPE_BLOG)
  await refusedWith(await search(pike, capped), 429, 'daily-limit')
  expect(dishIn(await boardOf(pike, board.id), capped)).toMatchObject({ recipe: null, recipeSearch: null })

  await endLimitWindow(PIKE, 'recipe-search')
  expect((await searched(pike, capped)).outcome).toBe('found')
})

test('a search "looking" for over five minutes counts as failed, one from a minute ago still runs', async () => {
  const owner = await signIn(STROUSTRUP)
  const board = await newBoard(owner)

  const stuck = await addDish(owner, board.id, 'Hängt', RECIPE_BLOG)
  await databaseRows(`update dish set recipe_search = 'looking', recipe_search_at = now() - interval '6 minutes' where id = $1`, [stuck])
  expect(dishIn(await boardOf(owner, board.id), stuck).recipeSearch).toBeNull()
  expect((await searched(owner, stuck)).outcome).toBe('found')

  const young = await addDish(owner, board.id, 'Läuft gerade', RECIPE_BLOG)
  await databaseRows(`update dish set recipe_search = 'looking', recipe_search_at = now() - interval '1 minute' where id = $1`, [young])
  expect(dishIn(await boardOf(owner, board.id), young).recipeSearch).toBe('looking')
  await refusedWith(await search(owner, young), 409, 'looking')
})

test('a Recipe longer than a Recipe holds is cut to its limits', async () => {
  const owner = await signIn(STROUSTRUP)
  const board = await newBoard(owner)
  const dishId = await addDish(owner, board.id, 'Festtagsmenü', LONG_RECIPE_BLOG)

  const { outcome, dish } = await searched(owner, dishId)
  expect(outcome).toBe('found')
  const { ingredients, steps } = dish.recipe!
  expect(ingredients).toHaveLength(60)
  expect(steps).toHaveLength(40)
  expect(ingredients.every(line => line.length <= 200)).toBe(true)
  expect(steps.every(line => line.length <= 1000)).toBe(true)
  expect(ingredients[2]).toBe('z'.repeat(200))
  expect(steps[1]).toBe('s'.repeat(1000))
})

test('the Admin Page counts a user\'s searches by how they ended, and the Event Log lists them', async () => {
  const wall = await signIn(WALL)
  const wallId = await idOf(wall)
  const board = await newBoard(wall)
  const found = await addDish(wall, board.id, 'Gefunden', RECIPE_BLOG)
  const none = await addDish(wall, board.id, 'Nichts', BLOG)
  const failed = await addDish(wall, board.id, 'Ausgefallen', UNREADABLE_BLOG)
  await searched(wall, found)
  await searched(wall, none)
  await searched(wall, failed)
  await searched(wall, failed)

  const operator = await signIn(OPERATOR)
  const listed = await (await operator.fetch('/api/admin/recipe-finder')).json() as AdminRecipeFinderUser[]
  expect(listed.find(u => u.id === wallId)?.searches).toEqual({ found: 1, none: 1, failed: 2 })

  const page = await (await operator.fetch(`/api/admin/events?board=${board.id}&kinds=recipe_found,recipe_not_found,recipe_search_failed`)).json() as AdminEventPage
  expect(page.events.map(e => e.kind).sort()).toEqual(['recipe_found', 'recipe_not_found', 'recipe_search_failed', 'recipe_search_failed'])
  expect(page.events.map(e => e.user)).toEqual(Array(4).fill({ id: wallId, name: expect.any(String) }))
})
