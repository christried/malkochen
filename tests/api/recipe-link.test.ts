import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { CAPTION_INSTRUCTIONS, PAGE_INSTRUCTIONS } from '../../server/recipe-finder/model'
import { askedToRead, startAnthropicService, type AnthropicService } from '../support/anthropic-service'
import { ANTHROPIC_PORT } from '../support/anthropic-port'
import {
  CHATTER_TIKTOK,
  DOWN_LINK_TIKTOK,
  FURTHER_PAGE,
  FURTHER_TIKTOK,
  LINKED_RECIPE_PAGE,
  LINKING_TIKTOK,
  LONG_TIKTOK,
  PIN_TO_RECIPE,
  PIN_TO_TEXT,
  PRIVATE_PATH,
  PRIVATE_TIKTOK,
  RECIPE_BLOG_RECIPE,
  RECIPE_BLOG_WITH_CAPTION,
  RECIPE_TIKTOK,
  TEXT_PAGE,
  TEXT_PAGE_TEXT,
  TEXT_TIKTOK,
  DOWN_LINKED_PAGE,
} from '../support/source-lookup-fixtures'
import { postDish } from './boards'
import { switchRecipeFinder, withoutSearchAfterAdding } from './recipe-finder-switch'
import { signIn, type Caller } from './client'
import { endLimitWindows, useUpLimit } from './time-travel'

// "Rezept finden" following a link (CONTEXT.md: Recipe Finder, Caption, #502):
// when neither the Source's page nor the Caption holds the Recipe, the search
// reads one more page: the link the model found in the Caption, or the
// destination of a Pin. Anthropic is the stand-in (anthropic-service.ts); the
// Captions and pages are the fixtures of tests/support/source-lookup-fixtures.ts
// (the app's own page fetching reads them in place of the web). What the model
// is asked, that a link the Caption doesn't hold or one to a non-public
// address is never fetched, and that a search follows one page and asks twice
// at most. The users below are used by this file only.

const OWNER = 'escoffier@example.com'
const MEMBER = 'child@example.com'
const CAPPED = 'beard@example.com'
const SENDER = 'ottolenghi@example.com'
const COPIER = 'oliver@example.com'

const LASAGNE_PAGE_RECIPE = { ...RECIPE_BLOG_RECIPE, link: LINKED_RECIPE_PAGE }
const TOFU = {
  ingredients: ['400 g Tofu', '2 EL Speisestärke', '1 EL Sojasauce & etwas Salz'],
  steps: ['Den Tofu pressen und in Würfel schneiden.', 'Mit Speisestärke und Sojasauce mischen.', 'Bei 200 °C 25 Minuten backen.'],
}
const NOTHING = { ingredients: [], steps: [] }
// The link the model names for the pages of the fixtures: as the Captions write them.
const NAMES_LASAGNE = { ...NOTHING, link: 'ofenliebe.example/linsenlasagne-vom-blech' }

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
async function addDish(caller: Caller, boardId: string, title: string, link: string): Promise<Dish> {
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

// The user message of the nth request to the stand-in.
function userMessage(n: number): string {
  const messages = anthropic.requests[n]!.body.messages as { role: string, content: string }[]
  return messages[0]!.content
}

test('a Caption that links to a page with recipe data gives that page\'s Recipe with the page\'s link, for every Member: one model call', async () => {
  const escoffier = await finderUser(OWNER)
  const child = await signIn(MEMBER)
  const board = await sharedBoard(escoffier, 'Rezept vom Blog', [child])
  const dish = await addDish(escoffier, board.id, 'Linsenlasagne', LINKING_TIKTOK)
  anthropic.answer(NAMES_LASAGNE)

  const answer = await found(escoffier, dish)

  expect(answer.outcome).toBe('found')
  expect(answer.dish.recipe).toEqual(LASAGNE_PAGE_RECIPE)
  expect(answer.dish.recipeSearch).toBeNull()
  expect(anthropic.requests).toHaveLength(1)
  for (const reader of [escoffier, child]) {
    expect(await onBoard(reader, board.id, dish)).toEqual(answer.dish)
  }
})

test('a linked page without recipe data has its text read by the model: two calls, the second one the page\'s text between <page> tags under the page instructions', async () => {
  const escoffier = await finderUser(OWNER)
  const board = await sharedBoard(escoffier, 'Seite ohne Rezeptdaten')
  const dish = await addDish(escoffier, board.id, 'Ofentofu', TEXT_TIKTOK)
  anthropic.answer({ caption: { ...NOTHING, link: TEXT_PAGE }, page: TOFU })

  const answer = await found(escoffier, dish)

  expect(answer.dish.recipe).toEqual({ ...TOFU, link: TEXT_PAGE })
  expect(anthropic.requests).toHaveLength(2)
  expect(askedToRead(anthropic.requests[0]!)).toBe('caption')
  expect(anthropic.requests[0]!.body.system).toBe(CAPTION_INSTRUCTIONS)
  expect(askedToRead(anthropic.requests[1]!)).toBe('page')
  expect(anthropic.requests[1]!.body.system).toBe(PAGE_INSTRUCTIONS)
  expect(anthropic.requests[1]!.body.messages).toEqual([{ role: 'user', content: `<page>\n${TEXT_PAGE_TEXT}\n</page>` }])
  // Text only: no markup, script, menu, form or comment of the page.
  expect(userMessage(1)).not.toMatch(/<(?!\/?page>)|dataLayer|tracking-id|Newsletter|Rezepte|ueber-mich|Mega lecker|Kommentar/)
})

test('a page longer than the limit is sent cut to it: 20 000 characters', async () => {
  const escoffier = await finderUser(OWNER)
  const board = await sharedBoard(escoffier, 'Langer Text')
  const dish = await addDish(escoffier, board.id, 'Langes Rezept', LONG_TIKTOK)
  anthropic.answer({ caption: { ...NOTHING, link: 'https://langer-text.example/mega-rezept' }, page: TOFU })

  expect((await found(escoffier, dish)).outcome).toBe('found')

  const sent = userMessage(1)
  expect(sent.startsWith('<page>\nLanges Rezept\n\naaaa')).toBe(true)
  expect(sent.endsWith('\n</page>')).toBe(true)
  expect(sent.slice('<page>\n'.length, -'\n</page>'.length)).toHaveLength(20_000)
})

test('a Pinterest Dish gets the Recipe of the Pin\'s destination page, with that page\'s link', async () => {
  const escoffier = await finderUser(OWNER)
  const child = await signIn(MEMBER)
  const board = await sharedBoard(escoffier, 'Pinterest', [child])
  const toRecipe = await addDish(escoffier, board.id, 'Lasagne vom Pin', PIN_TO_RECIPE)
  const toText = await addDish(escoffier, board.id, 'Tofu vom Pin', PIN_TO_TEXT)

  const recipeData = await found(escoffier, toRecipe)

  expect(recipeData.dish.recipe).toEqual(LASAGNE_PAGE_RECIPE)
  expect(anthropic.requests).toHaveLength(0)
  expect(await onBoard(child, board.id, toRecipe)).toEqual(recipeData.dish)

  // The Caption is read first (and names no link); the page's text then.
  anthropic.answer({ caption: 'empty', page: TOFU })
  const text = await found(escoffier, toText)

  expect(text.dish.recipe).toEqual({ ...TOFU, link: TEXT_PAGE })
  expect(anthropic.requests.map(askedToRead)).toEqual(['caption', 'page'])
})

test('a Recipe from the Source\'s own page, and one from the Caption itself, keep no link', async () => {
  const escoffier = await finderUser(OWNER)
  const board = await sharedBoard(escoffier, 'Ohne Link')
  const ownPage = await addDish(escoffier, board.id, 'Seite mit Rezept', RECIPE_BLOG_WITH_CAPTION)
  const caption = await addDish(escoffier, board.id, 'Beschreibung mit Rezept', RECIPE_TIKTOK)
  // The model names a page the Caption doesn't hold, which is never looked at.
  anthropic.answer({ ingredients: ['250 g rote Linsen', '1 Zwiebel'], steps: ['Alles kochen.'], link: LINKED_RECIPE_PAGE })

  expect((await found(escoffier, ownPage)).dish.recipe).toEqual({ ...RECIPE_BLOG_RECIPE, link: null })
  expect(anthropic.requests).toHaveLength(0)
  expect((await found(escoffier, caption)).dish.recipe).toEqual({ ingredients: ['250 g rote Linsen', '1 Zwiebel'], steps: ['Alles kochen.'], link: null })
  expect(anthropic.requests).toHaveLength(1)
})

test('a link the model names that is not in the Caption is never fetched: the page would have given a Recipe, and the search ends as nothing found', async () => {
  const escoffier = await finderUser(OWNER)
  const board = await sharedBoard(escoffier, 'Erfundener Link')
  const dish = await addDish(escoffier, board.id, 'Neues Video', CHATTER_TIKTOK)
  anthropic.answer({ ...NOTHING, link: LINKED_RECIPE_PAGE })

  const answer = await found(escoffier, dish)

  expect(answer).toMatchObject({ outcome: 'none', dish: { recipe: null, recipeSearch: 'none' } })
  expect(anthropic.requests).toHaveLength(1)
})

test('a link to a non-public address is never fetched: the stand-in sees no request for its path, and the search ends as failed', async () => {
  const escoffier = await finderUser(OWNER)
  const board = await sharedBoard(escoffier, 'Interner Link')
  const dish = await addDish(escoffier, board.id, 'Rezept zu Hause', PRIVATE_TIKTOK)
  anthropic.answer({ ...NOTHING, link: `http://127.0.0.1:${ANTHROPIC_PORT}${PRIVATE_PATH}` })

  const answer = await found(escoffier, dish)

  expect(answer).toMatchObject({ outcome: 'failed', dish: { recipe: null, recipeSearch: null } })
  expect(anthropic.requests.map(r => r.path)).toEqual(['/v1/messages'])
})

test('a followed page that can\'t be read is a failed search: no Recipe, repeatable, and no search of the day spent', async () => {
  const beard = await finderUser(CAPPED)
  const board = await sharedBoard(beard, 'Seite nicht da')
  const dish = await addDish(beard, board.id, 'Kaputter Link', DOWN_LINK_TIKTOK)
  const other = await addDish(beard, board.id, 'Linsenlasagne', LINKING_TIKTOK)
  const third = await addDish(beard, board.id, 'Noch eine', LINKING_TIKTOK)
  await useUpLimit(CAPPED, 'recipe-search', 29)
  anthropic.answer({ ...NOTHING, link: DOWN_LINKED_PAGE })

  for (let attempt = 0; attempt < 2; attempt++) {
    expect(await found(beard, dish)).toMatchObject({ outcome: 'failed', dish: { recipe: null, recipeSearch: null } })
    expect(await onBoard(beard, board.id, dish)).toMatchObject({ recipe: null, recipeSearch: null })
  }
  // 29 used: the failed ones gave theirs back, so there is one left.
  anthropic.answer(NAMES_LASAGNE)
  expect((await found(beard, other)).outcome).toBe('found')
  expect((await findRecipe(beard, third)).status).toBe(429)
}, 30_000)

test('a search follows one page and asks the model twice at most: a link in the page\'s text, or one the model names reading it, is never followed', async () => {
  const escoffier = await finderUser(OWNER)
  const board = await sharedBoard(escoffier, 'Nur eine Seite')
  const dish = await addDish(escoffier, board.id, 'Rezeptsammlung', FURTHER_TIKTOK)
  // The page's text holds a link to a page with a Recipe, and the model's answer for the page names it too.
  anthropic.answer({ caption: { ...NOTHING, link: FURTHER_PAGE }, page: { ...NOTHING, link: LINKED_RECIPE_PAGE } })

  const answer = await found(escoffier, dish)

  expect(answer).toMatchObject({ outcome: 'none', dish: { recipe: null, recipeSearch: 'none' } })
  expect(anthropic.requests.map(askedToRead)).toEqual(['caption', 'page'])
  expect(userMessage(1)).toContain(LINKED_RECIPE_PAGE)
  expect(anthropic.requests).toHaveLength(2)
})

test('a Copy of a Dish whose Recipe was found at a link takes the link along', async () => {
  const oliver = await finderUser(COPIER)
  const board = await sharedBoard(oliver, 'Original')
  const target = await sharedBoard(oliver, 'Kopie')
  const dish = await addDish(oliver, board.id, 'Linsenlasagne', LINKING_TIKTOK)
  anthropic.answer(NAMES_LASAGNE)
  expect((await found(oliver, dish)).dish.recipe).toEqual(LASAGNE_PAGE_RECIPE)

  const copied = await send(oliver, 'POST', `/api/dishes/${dish.id}/copy`, { boardId: target.id })
  expect(copied.status).toBe(201)
  const { dish: copy } = await copied.json() as { dish: Dish }

  expect(copy.recipe).toEqual(LASAGNE_PAGE_RECIPE)
  expect(await onBoard(oliver, target.id, copy)).toMatchObject({ recipe: LASAGNE_PAGE_RECIPE })
})

test('nothing is sent about the user, the Board or the Dish in either request', async () => {
  const ottolenghi = await finderUser(SENDER, { name: 'Zelda Zucchini' })
  const { id: userId } = await (await ottolenghi.fetch('/api/me')).json() as { id: string }
  const board = await sharedBoard(ottolenghi, 'Geheimes Familienbuch')
  const dish = await addDish(ottolenghi, board.id, 'Titel-Zebra', TEXT_TIKTOK)
  anthropic.answer({ caption: { ...NOTHING, link: TEXT_PAGE }, page: TOFU })

  await found(ottolenghi, dish)

  expect(anthropic.requests).toHaveLength(2)
  for (const { body } of anthropic.requests) {
    for (const unsent of ['tools', 'tool_choice', 'thinking', 'temperature', 'top_p', 'top_k', 'metadata']) expect(body).not.toHaveProperty(unsent)
    const sent = JSON.stringify(body)
    for (const private_ of [SENDER, 'Zelda', 'Zucchini', 'Geheimes Familienbuch', 'Titel-Zebra', TEXT_TIKTOK, 'mara.kocht', userId, board.id, dish.id]) {
      expect(sent, private_).not.toContain(private_)
    }
  }
  // The page's request holds neither the post's link nor the page's.
  expect(JSON.stringify(anthropic.requests[1]!.body)).not.toContain('veggie-kueche.example')
})
