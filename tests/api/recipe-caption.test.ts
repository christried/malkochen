import { afterAll, beforeAll, beforeEach, describe, expect, inject, test } from 'vitest'
import { CAPTION_INSTRUCTIONS } from '../../server/recipe-finder/model'
import type { RecipeFinderStatus } from '../../shared/recipe-finder'
import { startAnthropicService, type AnthropicService } from '../support/anthropic-service'
import {
  CHATTER_TIKTOK,
  DOWN_BLOG_WITH_CAPTION,
  NO_RECIPE_BLOG,
  NO_RECIPE_BLOG_WITH_CAPTION,
  RECIPE_BLOG_RECIPE,
  RECIPE_BLOG_WITH_CAPTION,
  RECIPE_CAPTION,
  RECIPE_TIKTOK,
} from '../support/source-lookup-fixtures'
import { TEST_ANTHROPIC_API_KEY } from '../support/test-auth-env'
import { postDish } from './boards'
import { switchRecipeFinder, withoutSearchAfterAdding } from './recipe-finder-switch'
import { signIn, type Caller } from './client'
import { everyEventAsText, watchEvents } from './event-log'
import { startApiServer, type RunningServer } from './server-boot'
import { endDishSearches, endLimitWindows, useUpLimit } from './time-travel'

// "Rezept finden" reading a Caption (CONTEXT.md: Recipe Finder, Caption,
// #501): when the Source's page carries no recipe data, a language model
// (Claude Haiku) reads the Dish's Caption. Anthropic is the stand-in
// (anthropic-service.ts); the Source pages and Captions are the fixtures of
// tests/support/source-lookup-fixtures.ts. What is sent, what each answer of
// the model ends in, that a hostile answer is cut to the Recipe's limits, and
// that without an API key nothing starts. The users below are used by this
// file only.

const OWNER = 'allen@example.com'
const MEMBER = 'noyce@example.com'
const CAPPED = 'kilby@example.com'
const SENDER = 'moore@example.com'
const KEYLESS = 'grove@example.com'

const RECIPE = {
  ingredients: ['250 g rote Linsen', '1 Zwiebel', '800 ml Brühe'],
  steps: ['Erst die Zwiebel anbraten.', 'Dann Linsen und Brühe dazu und 15 Min. köcheln lassen.'],
}

interface Recipe { ingredients: string[], steps: string[], link: string | null }
interface Dish {
  id: string
  caption: string | null
  recipe: Recipe | null
  recipeSearch: 'looking' | 'none' | null
}
interface Board {
  id: string
  inviteToken: string
  columns: { dishes: Dish[] }[]
}
interface Answer { outcome: 'found' | 'none' | 'failed', dish: Dish }

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, { method, ...body === undefined ? {} : json(body) })

let anthropic: AnthropicService

beforeAll(async () => {
  anthropic = await startAnthropicService()
})

afterAll(() => anthropic.close())

// Every test starts with the stand-in answering "no recipe", nothing asked of
// it yet, and the day's searches and lookups unused, whoever made them.
beforeEach(async () => {
  anthropic.forget()
  await endLimitWindows('recipe-search')
  await endLimitWindows('source-lookup')
})

// Signs in, with the Recipe Finder switched on by the Operator.
async function finderUser(email: string, profile?: { name: string }): Promise<Caller> {
  const caller = await signIn(email, profile)
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

// A Dish added the way the app adds one: Source Lookup reads the link, and
// its Source Ticket vouches for the Caption it read, which the Dish keeps.
async function addDish(caller: Caller, boardId: string, title: string, link: string, { captioned = true }: { captioned?: boolean } = {}): Promise<Dish> {
  // So no search starts by itself after adding (#503): "Rezept finden" is what is tested.
  return withoutSearchAfterAdding(caller, async () => {
    const lookedUp = await caller.fetch(`/api/source-lookup?link=${encodeURIComponent(link)}`)
    expect(lookedUp.status).toBe(200)
    const read = await lookedUp.json() as { canonicalLink: string, kind: string, caption: string | null, sourceTicket: string }
    const res = await postDish(caller, boardId, {
      title,
      placeholder: 'bowl',
      source: { link: read.canonicalLink, kind: read.kind },
      caption: read.caption,
      sourceTicket: read.sourceTicket,
    })
    expect(res.status, await res.clone().text()).toBe(201)
    const dish = await res.json() as Dish
    expect(dish.caption !== null, 'the Dish keeps the Caption Source Lookup read').toBe(captioned)
    return dish
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

test('a Dish whose Caption holds a recipe gets its Ingredients and Steps from it, for every Member of the Board', async () => {
  const allen = await finderUser(OWNER)
  const noyce = await signIn(MEMBER)
  const board = await sharedBoard(allen, 'Rezept aus der Beschreibung', [noyce])
  const dish = await addDish(allen, board.id, 'Linsensuppe', RECIPE_TIKTOK)
  anthropic.answer(RECIPE)

  const answer = await found(allen, dish)

  expect(answer.outcome).toBe('found')
  expect(answer.dish.recipe).toEqual({ ...RECIPE, link: null })
  expect(answer.dish.recipeSearch).toBeNull()
  for (const reader of [allen, noyce]) {
    expect(await onBoard(reader, board.id, dish)).toEqual(answer.dish)
  }
})

test('the model is asked only when the Source\'s page carried no recipe data', async () => {
  const allen = await finderUser(OWNER)
  const board = await sharedBoard(allen, 'Seite zuerst')
  const withData = await addDish(allen, board.id, 'Seite mit Rezept', RECIPE_BLOG_WITH_CAPTION)
  anthropic.answer(RECIPE)

  const answer = await found(allen, withData)

  expect(answer.dish.recipe).toEqual({ ...RECIPE_BLOG_RECIPE, link: null })
  expect(anthropic.requests).toHaveLength(0)

  const without = await addDish(allen, board.id, 'Seite ohne Rezept', NO_RECIPE_BLOG_WITH_CAPTION)
  expect((await found(allen, without)).dish.recipe).toEqual({ ...RECIPE, link: null })
  expect(anthropic.requests).toHaveLength(1)
})

test('what is sent is the instructions and the Caption as data, and nothing about the user, the Board or the Dish', async () => {
  const moore = await finderUser(SENDER, { name: 'Zelda Zucchini' })
  const { id: userId } = await (await moore.fetch('/api/me')).json() as { id: string }
  const board = await sharedBoard(moore, 'Geheimes Familienbuch')
  const dish = await addDish(moore, board.id, 'Titel-Zebra', RECIPE_TIKTOK)
  anthropic.answer(RECIPE)

  await found(moore, dish)

  expect(anthropic.requests).toHaveLength(1)
  const { apiKey, body } = anthropic.requests[0]!
  expect(apiKey).toBe(TEST_ANTHROPIC_API_KEY)
  expect(body.model).toBe('claude-haiku-5-5')
  expect(body.system).toBe(CAPTION_INSTRUCTIONS)
  expect(body.messages).toEqual([{ role: 'user', content: `<caption>\n${RECIPE_CAPTION}\n</caption>` }])
  for (const unsent of ['tools', 'tool_choice', 'thinking', 'temperature', 'top_p', 'top_k', 'metadata']) expect(body).not.toHaveProperty(unsent)
  const sent = JSON.stringify(body)
  for (const private_ of [SENDER, 'Zelda', 'Zucchini', 'Geheimes Familienbuch', 'Titel-Zebra', RECIPE_TIKTOK, 'mara.kocht', userId, board.id, dish.id]) {
    expect(sent, private_).not.toContain(private_)
  }
})

test('an empty answer ends as nothing found: the Board says so, and "Noch mal suchen" asks the model again', async () => {
  const allen = await finderUser(OWNER)
  const noyce = await signIn(MEMBER)
  const board = await sharedBoard(allen, 'Nur Geplauder', [noyce])
  const dish = await addDish(allen, board.id, 'Neues Video', CHATTER_TIKTOK)
  anthropic.answer('empty')

  const answer = await found(allen, dish)

  expect(answer).toMatchObject({ outcome: 'none', dish: { recipe: null, recipeSearch: 'none' } })
  expect(await onBoard(noyce, board.id, dish)).toMatchObject({ recipe: null, recipeSearch: 'none' })
  expect(anthropic.requests).toHaveLength(1)
  anthropic.answer(RECIPE)
  expect(await found(allen, dish)).toMatchObject({ outcome: 'found', dish: { recipe: { ...RECIPE, link: null }, recipeSearch: null } })
  expect(anthropic.requests).toHaveLength(2)
})

test('a refusal, a malformed answer, a dropped connection and a 500 each end as a failed search: no Recipe, repeatable, and no search of the day spent', async () => {
  const kilby = await finderUser(CAPPED)
  const board = await sharedBoard(kilby, 'Modell sagt nichts')
  const dish = await addDish(kilby, board.id, 'Linsensuppe', RECIPE_TIKTOK)
  const other = await addDish(kilby, board.id, 'Noch eine', RECIPE_TIKTOK)
  await useUpLimit(CAPPED, 'recipe-search', 29)

  for (const unanswered of ['refusal', 'malformed', 'dropped', 500] as const) {
    anthropic.answer(unanswered)
    anthropic.requests.splice(0)

    expect(await found(kilby, dish), `${unanswered}`).toMatchObject({ outcome: 'failed', dish: { recipe: null, recipeSearch: null } })

    expect(anthropic.requests.length, `${unanswered}`).toBeGreaterThanOrEqual(1)
    expect(await onBoard(kilby, board.id, dish)).toMatchObject({ recipe: null, recipeSearch: null })
    await endDishSearches(dish.id)
  }
  // 29 used: the failed ones gave theirs back, so there is one left.
  anthropic.answer(RECIPE)
  expect((await found(kilby, dish)).outcome).toBe('found')
  expect((await findRecipe(kilby, other)).status).toBe(429)
}, 30_000)

test('a page that can\'t be read does not stop the Caption from being read; when the Caption has no recipe either, the search failed, since the page may answer next time', async () => {
  const allen = await finderUser(OWNER)
  const board = await sharedBoard(allen, 'Seite nicht da')
  const dish = await addDish(allen, board.id, 'Kaputte Seite', DOWN_BLOG_WITH_CAPTION)

  anthropic.answer('empty')
  expect(await found(allen, dish)).toMatchObject({ outcome: 'failed', dish: { recipe: null, recipeSearch: null } })

  anthropic.answer(RECIPE)
  expect(await found(allen, dish)).toMatchObject({ outcome: 'found', dish: { recipe: { ...RECIPE, link: null } } })
})

test('an answer over the Recipe\'s limits is stored cut to them', async () => {
  const allen = await finderUser(OWNER)
  const board = await sharedBoard(allen, 'Zu viel auf einmal')
  const dish = await addDish(allen, board.id, 'Endlosrezept', RECIPE_TIKTOK)
  const ingredients = Array.from({ length: 61 }, (_, i) => i === 0 ? 'z'.repeat(250) : `Zutat ${i}`)
  anthropic.answer({ ingredients, steps: ['ß'.repeat(1100), 'Fertig.'] })

  const { dish: answered } = await found(allen, dish)

  expect(answered.recipe?.ingredients).toEqual([`${'z'.repeat(200)}`, ...ingredients.slice(1, 60)])
  expect(answered.recipe?.steps).toEqual(['ß'.repeat(1000), 'Fertig.'])
  expect(await onBoard(allen, board.id, dish)).toEqual(answered)
})

test('a Dish without a Caption whose page has no recipe data finds none, and the model is not asked', async () => {
  const allen = await finderUser(OWNER)
  const board = await sharedBoard(allen, 'Ohne Beschreibung')
  const dish = await addDish(allen, board.id, 'Shakshuka', NO_RECIPE_BLOG, { captioned: false })
  anthropic.answer(RECIPE)

  expect(await found(allen, dish)).toMatchObject({ outcome: 'none', dish: { recipe: null, recipeSearch: 'none' } })

  expect(anthropic.requests).toHaveLength(0)
})

test('the server says the Recipe Finder is available', async () => {
  const status = await (await (await signIn(OWNER)).fetch('/api/me/recipe-finder')).json() as RecipeFinderStatus

  expect(status.available).toBe(true)
})

test('finding a Recipe in a Caption and a model that failed are in the Event Log, without content', async () => {
  const allen = await finderUser(OWNER)
  const { id: userId } = await (await allen.fetch('/api/me')).json() as { id: string }
  const board = await sharedBoard(allen, 'Protokoll')
  const hit = await addDish(allen, board.id, 'Treffer', RECIPE_TIKTOK)
  const broken = await addDish(allen, board.id, 'Defekt', RECIPE_TIKTOK)
  const log = await watchEvents()

  anthropic.answer(RECIPE)
  await found(allen, hit)
  anthropic.answer('refusal')
  await found(allen, broken)

  expect(await log.recorded()).toEqual([
    { kind: 'recipe_found', boardId: board.id, dishId: hit.id, userId, details: null },
    { kind: 'recipe_search_failed', boardId: board.id, dishId: broken.id, userId, details: null },
  ])
  const text = await everyEventAsText()
  for (const content of ['Zwiebel', 'Brühe', 'Linsensuppe in 20']) expect(text).not.toContain(content)
})

// Without an API key the Recipe Finder does nothing. The test server has
// one, so a second instance of the built server is booted against the same
// database, without.
describe('without an API key', () => {
  let keyless: RunningServer

  async function signInToKeyless(email: string): Promise<Caller> {
    const res = await fetch(`${keyless.baseUrl}/api/auth/dev/sign-in`, { method: 'POST', headers: { 'content-type': 'application/json', 'origin': keyless.baseUrl }, body: JSON.stringify({ email }) })
    expect(res.ok).toBe(true)
    const cookie = res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
    return { fetch: (path, init) => fetch(`${keyless.baseUrl}${path}`, { ...init, headers: { 'accept-language': 'de-DE,de;q=0.9', ...init?.headers, cookie } }) }
  }

  beforeAll(async () => {
    keyless = await startApiServer({ port: 3195, databaseUrl: inject('databaseUrl'), env: { ANTHROPIC_API_KEY: '' } })
  }, 60_000)

  afterAll(() => keyless.stop())

  test('without an API key no search starts and nothing is spent, asked or left looking, and the server says so', async () => {
    const grove = await finderUser(KEYLESS)
    const board = await sharedBoard(grove, 'Ohne Schlüssel')
    const dish = await addDish(grove, board.id, 'Seite mit Rezept', RECIPE_BLOG_WITH_CAPTION)
    await useUpLimit(KEYLESS, 'recipe-search', 30)
    anthropic.answer(RECIPE)
    const there = await signInToKeyless(KEYLESS)

    const status = await (await there.fetch('/api/me/recipe-finder')).json() as RecipeFinderStatus
    await refusedWith(await findRecipe(there, dish), 503, 'Recipe Finder is not set up')

    expect(status).toEqual({ state: 'on', available: false })
    expect(anthropic.requests).toHaveLength(0)
    expect(await onBoard(grove, board.id, dish)).toMatchObject({ recipe: null, recipeSearch: null })
    // Not even the cap was looked at: with it, the same server refuses with 429 once it has a key.
    expect((await findRecipe(grove, dish)).status).toBe(429)
  })
})

test('a Dish added without its Caption has it read again from its Source when searched, keeps it, and the model reads it (#529)', async () => {
  const allen = await finderUser(OWNER)
  const board = await sharedBoard(allen, 'Alte Gerichte')
  // As a Dish added before Dishes kept their Caption: the Source, no Caption.
  const added = await withoutSearchAfterAdding(allen, () => postDish(allen, board.id, {
    title: 'Linsensuppe',
    placeholder: 'bowl',
    source: { link: RECIPE_TIKTOK, kind: 'tiktok' },
  }))
  expect(added.status).toBe(201)
  const dish = await added.json() as Dish
  expect(dish.caption).toBeNull()
  anthropic.answer(RECIPE)

  const answer = await found(allen, dish)

  expect(answer).toMatchObject({ outcome: 'found', dish: { caption: RECIPE_CAPTION, recipe: { ...RECIPE, link: null } } })
  expect(anthropic.requests[0]!.body.messages).toEqual([{ role: 'user', content: `<caption>\n${RECIPE_CAPTION}\n</caption>` }])
  expect((await onBoard(allen, board.id, dish)).caption).toBe(RECIPE_CAPTION)
})
