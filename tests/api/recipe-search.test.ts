import { beforeEach, expect, test } from 'vitest'
import type { AdminRecipeFinderUser } from '../../shared/recipe-finder'
import { postDish } from './boards'
import { switchRecipeFinder, withoutSearchAfterAdding } from './recipe-finder-switch'
import { anonymous, signIn, type Caller } from './client'
import { everyEventAsText, watchEvents } from './event-log'
import { backdateRecipeSearch, endLimitWindow, endLimitWindows, useUpLimit } from './time-travel'
import { OPERATOR } from '../support/test-auth-env'
import {
  DOWN_BLOG,
  NO_RECIPE_BLOG,
  OTHER_RECIPE_BLOG,
  OTHER_RECIPE_BLOG_RECIPE,
  PASTA_TIKTOK,
  RECIPE_BLOG,
  RECIPE_BLOG_RECIPE,
  SLOW_RECIPE_BLOG,
  SLOW_RECIPE_BLOG_RECIPE,
} from '../support/source-lookup-fixtures'

// "Rezept finden" (CONTEXT.md: Recipe Finder, #500): a user the Operator
// switched the Recipe Finder on for makes it look for the Recipe of a Dish
// that has a Source and no Recipe, here from the recipe data of a food
// blog's page (Source pages are the fixtures of
// tests/support/source-lookup-fixtures.ts). Who may, what the Dish then
// says, the cap of 30 a day and what the Event Log keeps. The users below
// are used by this file only.

const OWNER = 'wilkes@example.com'
const MEMBER = 'perlis@example.com'
const ASKED_ONLY = 'minsky@example.com'
const NO_EDIT = 'engelbart@example.com'
const EDITOR = 'sutherland@example.com'
const CAPPED = 'hamming@example.com'
const COUNTED = 'milner@example.com'

interface Recipe { ingredients: string[], steps: string[], link: string | null }
interface Dish {
  id: string
  recipe: Recipe | null
  recipeSearch: 'looking' | 'none' | null
}
interface Board {
  id: string
  inviteToken: string
  members: { id: string, name: string }[]
  columns: { dishes: Dish[] }[]
}
interface Answer { outcome: 'found' | 'none' | 'failed', dish: Dish }

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, { method, ...body === undefined ? {} : json(body) })

// Every test starts with the day's searches unused, whoever made them.
beforeEach(() => endLimitWindows('recipe-search'))

// Signs in, with the Recipe Finder switched on by the Operator.
async function finderUser(email: string): Promise<Caller> {
  const caller = await signIn(email)
  await switchRecipeFinder(caller, true)
  return caller
}

async function getBoard(caller: Caller, id: string): Promise<Board> {
  const res = await caller.fetch(`/api/boards/${id}`)
  expect(res.status).toBe(200)
  return res.json()
}

// A new Board of the owner's that the others have joined.
async function sharedBoard(owner: Caller, name: string, others: Caller[] = []): Promise<Board> {
  const created = await send(owner, 'POST', '/api/boards', { name, emoji: '🍲' })
  expect(created.status).toBe(201)
  const board = await getBoard(owner, (await created.json() as { id: string }).id)
  for (const other of others) expect((await send(other, 'POST', `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  return getBoard(owner, board.id)
}

async function addDish(caller: Caller, boardId: string, title: string, source: string | null = RECIPE_BLOG): Promise<Dish> {
  // So no search starts by itself after adding (#503): "Rezept finden" is what is tested.
  return withoutSearchAfterAdding(caller, async () => {
    const res = await postDish(caller, boardId, { title, placeholder: 'bowl', ...source && { source: { link: source, kind: 'blog' } } })
    expect(res.status, await res.clone().text()).toBe(201)
    return res.json()
  })
}

const findRecipe = (caller: Caller, dish: Dish) => send(caller, 'POST', `/api/dishes/${dish.id}/find-recipe`)

async function found(caller: Caller, dish: Dish): Promise<Answer> {
  const res = await findRecipe(caller, dish)
  expect(res.status, await res.clone().text()).toBe(200)
  return res.json()
}

// The Dish as the Board shows it now.
async function onBoard(caller: Caller, boardId: string, dish: Dish): Promise<Dish> {
  return (await getBoard(caller, boardId)).columns.flatMap(c => c.dishes).find(d => d.id === dish.id)!
}

async function refusedWith(res: Response, status: number, message: string) {
  expect(res.status).toBe(status)
  expect((await res.json() as { statusMessage: string }).statusMessage).toBe(message)
}

async function versionOf(caller: Caller, boardId: string): Promise<number> {
  return ((await (await caller.fetch(`/api/boards/${boardId}/version`)).json()) as { version: number }).version
}

// Waits until the Board shows the Dish with the search in the given state.
async function untilSearch(caller: Caller, boardId: string, dish: Dish, state: Dish['recipeSearch']): Promise<void> {
  for (let tries = 0; tries < 100; tries++) {
    if ((await onBoard(caller, boardId, dish)).recipeSearch === state) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`the Dish never showed its search as ${state}`)
}

test('a Recipe Finder user\'s "Rezept finden" fills in the Recipe the Source\'s page carries, for every Member of the Board', async () => {
  const wilkes = await finderUser(OWNER)
  const perlis = await signIn(MEMBER)
  const board = await sharedBoard(wilkes, 'Rezept von der Seite', [perlis])
  const dish = await addDish(wilkes, board.id, 'Linsenlasagne')
  expect(dish.recipe).toBeNull()

  const answer = await found(wilkes, dish)

  expect(answer.outcome).toBe('found')
  expect(answer.dish.recipe).toEqual({ ...RECIPE_BLOG_RECIPE, link: null })
  expect(answer.dish.recipeSearch).toBeNull()
  // Perlis hasn't the Recipe Finder, and sees what it found all the same.
  for (const reader of [wilkes, perlis]) {
    expect(await onBoard(reader, board.id, dish)).toEqual(answer.dish)
  }
})

test('finding moves the Board Version on, so an open Board loads the Recipe', async () => {
  const wilkes = await finderUser(OWNER)
  const board = await sharedBoard(wilkes, 'Neue Version')
  const dish = await addDish(wilkes, board.id, 'Linsenlasagne')
  const before = await versionOf(wilkes, board.id)

  await found(wilkes, dish)

  expect(await versionOf(wilkes, board.id)).toBeGreaterThan(before)
})

test('a user without the Recipe Finder is refused, one who only asked too, and nothing is looked up', async () => {
  const perlis = await signIn(MEMBER)
  const minsky = await signIn(ASKED_ONLY)
  expect((await send(minsky, 'POST', '/api/me/recipe-finder')).status).toBe(200)
  const board = await sharedBoard(perlis, 'Ohne Rezeptfinder', [minsky])
  const dish = await addDish(perlis, board.id, 'Linsenlasagne')

  await refusedWith(await findRecipe(perlis, dish), 403, 'Recipe Finder is off')
  await refusedWith(await findRecipe(minsky, dish), 403, 'Recipe Finder is off')

  expect(await onBoard(perlis, board.id, dish)).toMatchObject({ recipe: null, recipeSearch: null })
})

test('without "edit Dishes" a Member can\'t search for another Member\'s Dish, but can for their own', async () => {
  const wilkes = await finderUser(OWNER)
  const engelbart = await finderUser(NO_EDIT)
  const board = await sharedBoard(wilkes, 'Nur ansehen', [engelbart])
  const engelbartId = board.members.find(m => m.name === 'engelbart')!.id
  expect((await send(wilkes, 'PATCH', `/api/boards/${board.id}/members/${engelbartId}/permissions`, { editDishes: false })).status).toBe(200)
  const theirs = await addDish(wilkes, board.id, 'Wilkes\' Gericht')
  const own = await addDish(engelbart, board.id, 'Engelbarts Gericht')

  const refused = await findRecipe(engelbart, theirs)
  expect(refused.status).toBe(403)
  expect((await refused.json() as { data: unknown }).data).toEqual({ permission: 'editDishes' })
  expect(await onBoard(wilkes, board.id, theirs)).toMatchObject({ recipe: null, recipeSearch: null })

  expect((await found(engelbart, own)).dish.recipe).toEqual({ ...RECIPE_BLOG_RECIPE, link: null })
})

test('a Member with "edit Dishes" searches for a Dish another Member added', async () => {
  const wilkes = await signIn(OWNER)
  const sutherland = await finderUser(EDITOR)
  const board = await sharedBoard(wilkes, 'Fremdes Gericht', [sutherland])
  const theirs = await addDish(wilkes, board.id, 'Wilkes\' Gericht')

  const answer = await found(sutherland, theirs)

  expect(answer.dish.recipe).toEqual({ ...RECIPE_BLOG_RECIPE, link: null })
  expect((await onBoard(wilkes, board.id, theirs)).recipe).toEqual(answer.dish.recipe)
})

test('a Dish someone can\'t see is not found', async () => {
  const outsider = await finderUser(EDITOR)
  const wilkes = await signIn(OWNER)
  const board = await sharedBoard(wilkes, 'Nicht für Fremde')
  const dish = await addDish(wilkes, board.id, 'Geheim')

  expect((await findRecipe(outsider, dish)).status).toBe(404)
  expect((await findRecipe(outsider, { ...dish, id: '00000000-0000-4000-8000-000000000000' })).status).toBe(404)
})

test('a Dish without a Source is refused', async () => {
  const wilkes = await finderUser(OWNER)
  const board = await sharedBoard(wilkes, 'Aus dem Kopf')
  const dish = await addDish(wilkes, board.id, 'Omas Eintopf', null)

  await refusedWith(await findRecipe(wilkes, dish), 409, 'Dish has no Source')
})

test('a Dish with anything in its Recipe is refused: Ingredients only, Steps only', async () => {
  const wilkes = await finderUser(OWNER)
  const board = await sharedBoard(wilkes, 'Schon beschrieben')
  const withIngredients = await addDish(wilkes, board.id, 'Mit Zutaten')
  const withSteps = await addDish(wilkes, board.id, 'Mit Schritten')
  expect((await send(wilkes, 'PATCH', `/api/dishes/${withIngredients.id}`, { recipe: { ingredients: ['Salz'], steps: [] } })).status).toBe(200)
  expect((await send(wilkes, 'PATCH', `/api/dishes/${withSteps.id}`, { recipe: { ingredients: [], steps: ['Kochen.'] } })).status).toBe(200)

  await refusedWith(await findRecipe(wilkes, withIngredients), 409, 'Dish has a Recipe')
  await refusedWith(await findRecipe(wilkes, withSteps), 409, 'Dish has a Recipe')

  expect((await onBoard(wilkes, board.id, withIngredients)).recipe).toEqual({ ingredients: ['Salz'], steps: [], link: null })
})

test('a Recipe typed while the search ran is not overwritten, and the Dish says it is looking meanwhile', async () => {
  const wilkes = await finderUser(OWNER)
  const perlis = await signIn(MEMBER)
  const board = await sharedBoard(wilkes, 'Schneller getippt', [perlis])
  const dish = await addDish(wilkes, board.id, 'Kürbissuppe', SLOW_RECIPE_BLOG)

  const searching = findRecipe(wilkes, dish)
  await untilSearch(perlis, board.id, dish, 'looking')
  const typed = { ingredients: ['Ein Kürbis'], steps: ['Selbst gekocht.'] }
  expect((await send(wilkes, 'PATCH', `/api/dishes/${dish.id}`, { recipe: typed })).status).toBe(200)
  const answer = await (await searching).json() as Answer

  expect(answer.dish.recipe).toEqual({ ...typed, link: null })
  expect(answer.dish.recipeSearch).toBeNull()
  expect(await onBoard(perlis, board.id, dish)).toEqual(answer.dish)
})

test('a second search while one is looking is refused', async () => {
  const wilkes = await finderUser(OWNER)
  const board = await sharedBoard(wilkes, 'Zweimal getippt')
  const dish = await addDish(wilkes, board.id, 'Kürbissuppe', SLOW_RECIPE_BLOG)

  const searching = findRecipe(wilkes, dish)
  await untilSearch(wilkes, board.id, dish, 'looking')
  await refusedWith(await findRecipe(wilkes, dish), 409, 'Already looking')

  const answer = await (await searching).json() as Answer
  expect(answer).toMatchObject({ outcome: 'found', dish: { recipe: { ...SLOW_RECIPE_BLOG_RECIPE } } })
})

test('a search that has been looking for over five minutes counts as over, and the Dish may be searched again', async () => {
  const wilkes = await finderUser(OWNER)
  const board = await sharedBoard(wilkes, 'Hängengeblieben')
  const dish = await addDish(wilkes, board.id, 'Kürbissuppe', SLOW_RECIPE_BLOG)
  const log = await watchEvents()

  const first = findRecipe(wilkes, dish)
  await untilSearch(wilkes, board.id, dish, 'looking')
  await backdateRecipeSearch(dish.id, 10)
  expect((await onBoard(wilkes, board.id, dish)).recipeSearch).toBeNull()
  const second = findRecipe(wilkes, dish)

  // The first one finds its Dish claimed by the second and writes nothing.
  expect((await first).status).toBe(200)
  const answer = await (await second).json() as Answer
  expect(answer).toMatchObject({ outcome: 'found', dish: { recipe: { ...SLOW_RECIPE_BLOG_RECIPE }, recipeSearch: null } })
  expect((await log.recorded()).filter(e => e.kind === 'recipe_found')).toHaveLength(1)
})

test('a page without recipe data: the Dish says nothing was found, and it isn\'t searched again until its Source changes', async () => {
  const wilkes = await finderUser(OWNER)
  const perlis = await signIn(MEMBER)
  const board = await sharedBoard(wilkes, 'Nichts gefunden', [perlis])
  const dish = await addDish(wilkes, board.id, 'Shakshuka', NO_RECIPE_BLOG)

  const answer = await found(wilkes, dish)

  expect(answer).toMatchObject({ outcome: 'none', dish: { recipe: null, recipeSearch: 'none' } })
  expect(await onBoard(perlis, board.id, dish)).toMatchObject({ recipe: null, recipeSearch: 'none' })
  await refusedWith(await findRecipe(wilkes, dish), 409, 'Nothing found for this Source')

  // The same link again keeps it; another Source starts afresh.
  expect((await send(wilkes, 'PATCH', `/api/dishes/${dish.id}`, { source: { link: NO_RECIPE_BLOG, kind: 'blog' } })).status).toBe(200)
  expect((await onBoard(wilkes, board.id, dish)).recipeSearch).toBe('none')
  const moved = await send(wilkes, 'PATCH', `/api/dishes/${dish.id}`, { source: { link: OTHER_RECIPE_BLOG, kind: 'blog' } })
  expect(moved.status).toBe(200)
  expect((await moved.json() as Dish).recipeSearch).toBeNull()
  expect((await found(wilkes, dish)).dish.recipe).toEqual({ ...OTHER_RECIPE_BLOG_RECIPE, link: null })
})

test('a kind of Source that never carries recipe data finds none, without a request', async () => {
  const wilkes = await finderUser(OWNER)
  const board = await sharedBoard(wilkes, 'Nur ein Video')
  const dish = await addDish(wilkes, board.id, 'Pilzpasta', PASTA_TIKTOK)

  expect(await found(wilkes, dish)).toMatchObject({ outcome: 'none', dish: { recipeSearch: 'none' } })
})

test('a page that can\'t be read is a failed search: the Dish is as it was, it can be repeated and it costs no search of the day', async () => {
  const hamming = await finderUser(CAPPED)
  const board = await sharedBoard(hamming, 'Seite nicht da')
  const down = await addDish(hamming, board.id, 'Kaputte Seite', DOWN_BLOG)
  const good = await addDish(hamming, board.id, 'Gute Seite')
  const other = await addDish(hamming, board.id, 'Noch eine', OTHER_RECIPE_BLOG)
  await useUpLimit(CAPPED, 'recipe-search', 29)

  expect(await found(hamming, down)).toMatchObject({ outcome: 'failed', dish: { recipe: null, recipeSearch: null } })
  expect(await found(hamming, down)).toMatchObject({ outcome: 'failed' })
  expect((await onBoard(hamming, board.id, down)).recipeSearch).toBeNull()
  // 29 used: the failed ones gave theirs back, so there is one left.
  expect((await found(hamming, good)).outcome).toBe('found')
  expect((await findRecipe(hamming, other)).status).toBe(429)
})

test('the 31st search of a day is refused, the Dish is not left looking, and the next day it works again', async () => {
  const hamming = await finderUser(CAPPED)
  const board = await sharedBoard(hamming, 'Dreißig am Tag')
  const dish = await addDish(hamming, board.id, 'Linsenlasagne')
  await useUpLimit(CAPPED, 'recipe-search', 30)

  const refused = await findRecipe(hamming, dish)

  expect(refused.status).toBe(429)
  expect(await onBoard(hamming, board.id, dish)).toMatchObject({ recipe: null, recipeSearch: null })
  await endLimitWindow(CAPPED, 'recipe-search')
  expect((await found(hamming, dish)).outcome).toBe('found')
})

test('refused searches (no Source, a Recipe, nothing found) cost no search of the day', async () => {
  const hamming = await finderUser(CAPPED)
  const board = await sharedBoard(hamming, 'Abgelehnt kostet nichts')
  const withoutSource = await addDish(hamming, board.id, 'Ohne Quelle', null)
  const good = await addDish(hamming, board.id, 'Gute Seite')
  await useUpLimit(CAPPED, 'recipe-search', 29)

  expect((await findRecipe(hamming, withoutSource)).status).toBe(409)
  expect((await findRecipe(hamming, withoutSource)).status).toBe(409)

  expect((await found(hamming, good)).outcome).toBe('found')
  expect((await findRecipe(hamming, good)).status).toBe(409)
})

test('the search state is part of what the Board serves, and is not on the Dish Link\'s page', async () => {
  const wilkes = await finderUser(OWNER)
  const board = await sharedBoard(wilkes, 'Zustand im Board')
  const dish = await addDish(wilkes, board.id, 'Shakshuka', NO_RECIPE_BLOG)
  expect(await onBoard(wilkes, board.id, dish)).toHaveProperty('recipeSearch', null)
  await found(wilkes, dish)
  expect(await onBoard(wilkes, board.id, dish)).toHaveProperty('recipeSearch', 'none')

  const link = await send(wilkes, 'POST', `/api/dishes/${dish.id}/link`)
  expect(link.status).toBe(200)
  const { path } = await link.json() as { path: string }
  const page = await anonymous().fetch(`/api/dish-links/${path.replace('/d/', '')}`)
  expect(page.status).toBe(200)
  expect(await page.text()).not.toContain('recipeSearch')
})

test('a Copy starts without a search state: it may be searched for itself', async () => {
  const wilkes = await finderUser(OWNER)
  const board = await sharedBoard(wilkes, 'Original')
  const target = await sharedBoard(wilkes, 'Kopie')
  const dish = await addDish(wilkes, board.id, 'Shakshuka', NO_RECIPE_BLOG)
  await found(wilkes, dish)

  const copied = await send(wilkes, 'POST', `/api/dishes/${dish.id}/copy`, { boardId: target.id })
  expect(copied.status).toBe(201)

  expect((await copied.json() as { dish: Dish }).dish).toMatchObject({ recipeSearch: null })
})

test('the three ends of a search are in the Event Log, once each, as Dish events of the searching user, without content', async () => {
  const milner = await finderUser(COUNTED)
  const { id: userId } = await (await milner.fetch('/api/me')).json() as { id: string }
  const board = await sharedBoard(milner, 'Protokoll')
  const hit = await addDish(milner, board.id, 'Treffer')
  const miss = await addDish(milner, board.id, 'Niete', NO_RECIPE_BLOG)
  const broken = await addDish(milner, board.id, 'Defekt', DOWN_BLOG)
  const refusedOnes = await addDish(milner, board.id, 'Ohne Quelle', null)
  const log = await watchEvents()

  await found(milner, hit)
  await found(milner, miss)
  await found(milner, broken)
  await findRecipe(milner, refusedOnes)
  await findRecipe(milner, miss)

  expect(await log.recorded()).toEqual([
    { kind: 'recipe_found', boardId: board.id, dishId: hit.id, userId, details: null },
    { kind: 'recipe_not_found', boardId: board.id, dishId: miss.id, userId, details: null },
    { kind: 'recipe_search_failed', boardId: board.id, dishId: broken.id, userId, details: null },
  ])
  const text = await everyEventAsText()
  for (const content of ['Lasagneplatten', 'rote Linsen', 'anbraten']) expect(text).not.toContain(content)
})

test('the Admin Page counts a user\'s searches from their events', async () => {
  const milner = await finderUser(COUNTED)
  const { id } = await (await milner.fetch('/api/me')).json() as { id: string }
  const operator = await signIn(OPERATOR)
  const searchesOf = async () => ((await (await operator.fetch('/api/admin/recipe-finder')).json()) as AdminRecipeFinderUser[]).find(u => u.id === id)!.searches
  const before = await searchesOf()
  const board = await sharedBoard(milner, 'Gezählt')

  await found(milner, await addDish(milner, board.id, 'Treffer'))
  await found(milner, await addDish(milner, board.id, 'Niete', NO_RECIPE_BLOG))
  await found(milner, await addDish(milner, board.id, 'Defekt', DOWN_BLOG))

  expect(await searchesOf()).toBe(before + 3)
  const page = await (await operator.fetch('/api/admin/events?kinds=recipe_found,recipe_not_found,recipe_search_failed')).json() as { events: { kind: string, user: { id: string } }[] }
  expect(page.events.filter(e => e.user.id === id).map(e => e.kind).toSorted()).toEqual(expect.arrayContaining(['recipe_found', 'recipe_not_found', 'recipe_search_failed']))
})
