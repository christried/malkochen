import { randomUUID } from 'node:crypto'
import { beforeEach, expect, test } from 'vitest'
import type { AdminRecipeFinderUser } from '../../shared/recipe-finder'
import { postDish } from './boards'
import { signIn, type Caller } from './client'
import { everyEventAsText, watchEvents } from './event-log'
import { switchRecipeFinder } from './recipe-finder-switch'
import { backdateRecipeSearch, databaseRows, endLimitWindows, useUpLimit } from './time-travel'
import { OPERATOR } from '../support/test-auth-env'
import {
  DOWN_BLOG,
  RECIPE_BLOG,
  RECIPE_BLOG_RECIPE,
  SLOW_RECIPE_BLOG,
  SLOW_RECIPE_BLOG_RECIPE,
} from '../support/source-lookup-fixtures'

// The search after adding (CONTEXT.md: Recipe Finder, #503): a Dish a Recipe
// Finder user adds with a Source is answered at once, says it is looking, and
// has its Recipe a moment later, without anyone asking. Who it happens for
// (not a Copy, not a Dish without a Source, not a Tour Dish), the daily cap,
// the Board Version, and a search that never finishes. The page of
// SLOW_RECIPE_BLOG answers after 1.5 seconds, so a search that is still under
// way can be watched. The users below are used by this file only.

const FINDER = 'hazan@example.com'
const OTHER_MEMBER = 'bocuse@example.com'
const FINDER_OFF = 'pepin@example.com'
const ASKED_ONLY = 'roden@example.com'
const CAPPED = 'jaffrey@example.com'
const NO_FINDER_ADDER = 'bourdain@example.com'

interface Recipe { ingredients: string[], steps: string[], link: string | null }
interface Dish {
  id: string
  recipe: Recipe | null
  recipeSearch: 'looking' | 'none' | null
}
interface Board {
  id: string
  inviteToken: string
  columns: { dishes: Dish[] }[]
}

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

async function addDish(caller: Caller, boardId: string, title: string, source: string | null = RECIPE_BLOG, extra: object = {}): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl', ...source && { source: { link: source, kind: 'blog' } }, ...extra })
  expect(res.status, await res.clone().text()).toBe(201)
  return res.json()
}

// A Dish added offline, as the device sends it.
async function addDishOffline(caller: Caller, boardId: string, link: string): Promise<Dish> {
  const res = await postDish(caller, boardId, { offline: true, id: randomUUID(), placeholder: 'ramen', source: { link } })
  expect(res.status, await res.clone().text()).toBe(201)
  return res.json()
}

// The Dish as the Board shows it now.
async function onBoard(caller: Caller, boardId: string, dish: { id: string }): Promise<Dish> {
  return (await getBoard(caller, boardId)).columns.flatMap(c => c.dishes).find(d => d.id === dish.id)!
}

async function versionOf(caller: Caller, boardId: string): Promise<number> {
  return ((await (await caller.fetch(`/api/boards/${boardId}/version`)).json()) as { version: number }).version
}

async function until(what: string, done: () => Promise<boolean>): Promise<void> {
  for (let tries = 0; tries < 120; tries++) {
    if (await done()) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`never happened: ${what}`)
}

// Waits until the Board shows the Dish as no longer looking.
const untilNotLooking = (caller: Caller, boardId: string, dish: { id: string }) =>
  until('the Dish stopped looking', async () => (await onBoard(caller, boardId, dish)).recipeSearch !== 'looking')

// Long enough for SLOW_RECIPE_BLOG's page (1.5 seconds) to have been read
// and the search to have ended, had one been started.
const pastTheSlowBlog = () => new Promise(resolve => setTimeout(resolve, 2500))

// The searches of the day the user's limit counts, of those within the window.
async function searchesCounted(email: string): Promise<number> {
  const [row] = await databaseRows<{ calls: number }>(
    `select calls from rate_limit_use
     where limited = 'recipe-search' and window_start > now() - interval '1 day' and user_id = (select id from "user" where email = $1)`,
    [email],
  )
  return row?.calls ?? 0
}

test('a Dish a Recipe Finder user adds with a Source is answered looking, without waiting, and then has its Recipe on the Board', async () => {
  const hazan = await finderUser(FINDER)
  const bocuse = await signIn(OTHER_MEMBER)
  const board = await sharedBoard(hazan, 'Von selbst', [bocuse])
  const log = await watchEvents()

  const dish = await addDish(hazan, board.id, 'Kürbissuppe', SLOW_RECIPE_BLOG)

  expect(dish.recipeSearch).toBe('looking')
  expect(dish.recipe).toBeNull()
  expect((await onBoard(bocuse, board.id, dish)).recipeSearch).toBe('looking')

  await untilNotLooking(bocuse, board.id, dish)
  expect(await onBoard(bocuse, board.id, dish)).toMatchObject({ recipeSearch: null, recipe: { ...SLOW_RECIPE_BLOG_RECIPE, link: null } })
  expect((await log.recorded()).filter(e => e.kind.startsWith('recipe_'))).toMatchObject([{ kind: 'recipe_found', boardId: board.id, dishId: dish.id }])
})

test('the Recipe arriving moves the Board Version on, so an open Board loads it', async () => {
  const hazan = await finderUser(FINDER)
  const board = await sharedBoard(hazan, 'Version von selbst')
  const dish = await addDish(hazan, board.id, 'Kürbissuppe', SLOW_RECIPE_BLOG)
  const before = await versionOf(hazan, board.id)

  await untilNotLooking(hazan, board.id, dish)

  expect(await versionOf(hazan, board.id)).toBeGreaterThan(before)
})

test.each([
  ['without the Recipe Finder', FINDER_OFF],
  ['who only asked for the Recipe Finder', ASKED_ONLY],
])('a Dish added by a user %s gets no search', async (_, email) => {
  const adder = await signIn(email)
  if (email === ASKED_ONLY) expect((await send(adder, 'POST', '/api/me/recipe-finder')).status).toBe(200)
  const board = await sharedBoard(adder, 'Ohne Rezeptfinder')
  const log = await watchEvents()

  const dish = await addDish(adder, board.id, 'Kürbissuppe', SLOW_RECIPE_BLOG)
  await pastTheSlowBlog()

  expect(dish.recipeSearch).toBeNull()
  expect(await onBoard(adder, board.id, dish)).toMatchObject({ recipeSearch: null, recipe: null })
  expect((await log.recorded()).filter(e => e.kind.startsWith('recipe_'))).toEqual([])
})

test('a Dish without a Source, and a Copy of a Dish with one, get no search', async () => {
  const hazan = await finderUser(FINDER)
  const bourdain = await signIn(NO_FINDER_ADDER)
  const shared = await sharedBoard(bourdain, 'Kopiervorlage', [hazan])
  const own = await sharedBoard(hazan, 'Eigene Kopien')
  const original = await addDish(bourdain, shared.id, 'Kürbissuppe', SLOW_RECIPE_BLOG)
  const log = await watchEvents()

  const bare = await addDish(hazan, own.id, 'Ohne Link', null)
  const res = await send(hazan, 'POST', `/api/dishes/${original.id}/copy`, { boardId: own.id })
  expect(res.status, await res.clone().text()).toBe(201)
  const { dish: copy } = await res.json() as { dish: Dish }
  await pastTheSlowBlog()

  expect(bare.recipeSearch).toBeNull()
  expect(copy.recipeSearch).toBeNull()
  expect(await onBoard(hazan, own.id, bare)).toMatchObject({ recipeSearch: null, recipe: null })
  expect(await onBoard(hazan, own.id, copy)).toMatchObject({ recipeSearch: null, recipe: null })
  expect((await log.recorded()).filter(e => e.kind.startsWith('recipe_'))).toEqual([])
})

test('a Dish a Recipe Finder user added offline is searched once it arrives', async () => {
  const hazan = await finderUser(FINDER)
  const board = await sharedBoard(hazan, 'Offline von selbst')

  const dish = await addDishOffline(hazan, board.id, RECIPE_BLOG)

  expect(dish.recipeSearch).toBe('looking')
  await untilNotLooking(hazan, board.id, dish)
  expect(await onBoard(hazan, board.id, dish)).toMatchObject({ recipeSearch: null, recipe: { ...RECIPE_BLOG_RECIPE, link: null } })
})

test('at the daily cap the Dish is added as ever and no search starts, nor is another counted', async () => {
  const jaffrey = await finderUser(CAPPED)
  const { id } = await (await jaffrey.fetch('/api/me')).json() as { id: string }
  const operator = await signIn(OPERATOR)
  const searchesOf = async () => ((await (await operator.fetch('/api/admin/recipe-finder')).json()) as AdminRecipeFinderUser[]).find(u => u.id === id)!.searches
  const board = await sharedBoard(jaffrey, 'Am Limit')
  await useUpLimit(CAPPED, 'recipe-search', 30)
  const before = await searchesOf()
  const log = await watchEvents()

  const dish = await addDish(jaffrey, board.id, 'Linsenlasagne')
  const offline = await addDishOffline(jaffrey, board.id, RECIPE_BLOG)
  await pastTheSlowBlog()

  expect(dish.recipeSearch).toBeNull()
  expect(offline.recipeSearch).toBeNull()
  expect(await onBoard(jaffrey, board.id, dish)).toMatchObject({ recipeSearch: null, recipe: null })
  expect(await onBoard(jaffrey, board.id, offline)).toMatchObject({ recipeSearch: null, recipe: null })
  expect((await log.recorded()).filter(e => e.kind.startsWith('recipe_'))).toEqual([])
  expect(await searchesOf()).toBe(before)
})

test('a Dish added during the Tour gets no search', async () => {
  const hazan = await finderUser(FINDER)
  const board = await sharedBoard(hazan, 'Tour')
  const log = await watchEvents()

  const dish = await addDish(hazan, board.id, 'Kürbissuppe', SLOW_RECIPE_BLOG, { tour: true })
  await pastTheSlowBlog()

  expect(dish.recipeSearch).toBeNull()
  expect(await onBoard(hazan, board.id, dish)).toMatchObject({ recipeSearch: null, recipe: null })
  expect((await log.recorded()).filter(e => e.kind.startsWith('recipe_'))).toEqual([])
})

test('a search that never finishes stops counting as looking, "Rezept finden" works for it, and the stale search writes nothing over it', async () => {
  const hazan = await finderUser(FINDER)
  const board = await sharedBoard(hazan, 'Hängengeblieben')
  const log = await watchEvents()
  const dish = await addDish(hazan, board.id, 'Kürbissuppe', SLOW_RECIPE_BLOG)
  expect(dish.recipeSearch).toBe('looking')

  await backdateRecipeSearch(dish.id, 6)
  expect((await onBoard(hazan, board.id, dish)).recipeSearch).toBeNull()
  const res = await send(hazan, 'POST', `/api/dishes/${dish.id}/find-recipe`)
  expect(res.status, await res.clone().text()).toBe(200)
  expect(await res.json()).toMatchObject({ outcome: 'found', dish: { recipeSearch: null, recipe: { ...SLOW_RECIPE_BLOG_RECIPE, link: null } } })
  // The first search ends meanwhile, and finds nothing to write.
  await pastTheSlowBlog()

  expect(await onBoard(hazan, board.id, dish)).toMatchObject({ recipeSearch: null, recipe: { ...SLOW_RECIPE_BLOG_RECIPE, link: null } })
  expect((await log.recorded()).filter(e => e.kind.startsWith('recipe_')).map(e => e.kind)).toEqual(['recipe_found'])
})

test('a search after adding that fails leaves the Dish not looking and costs no search of the day', async () => {
  const hazan = await finderUser(FINDER)
  const board = await sharedBoard(hazan, 'Seite weg')
  const log = await watchEvents()

  const dish = await addDish(hazan, board.id, 'Defekt', DOWN_BLOG)
  expect(dish.recipeSearch).toBe('looking')

  await untilNotLooking(hazan, board.id, dish)
  await until('the failed search was refunded', async () => (await searchesCounted(FINDER)) === 0)
  expect(await onBoard(hazan, board.id, dish)).toMatchObject({ recipeSearch: null, recipe: null })
  expect((await log.recorded()).filter(e => e.kind.startsWith('recipe_')).map(e => e.kind)).toEqual(['recipe_search_failed'])
  expect(await everyEventAsText()).not.toContain('Zutaten')
})
