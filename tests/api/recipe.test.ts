import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { watchEvents } from './event-log'

// The Recipe (CONTEXT.md, #494): a Dish's Ingredients and Steps, each a plain
// line of text in an order. Written through the Dish edit (PATCH
// /api/dishes/:id) as a whole, read back wherever the Dish is. Who may write
// it is in dish-permissions.test.ts; what it leaves alone (the Dish History,
// Push Notifications, the Email Digest) in those tests' own files.

interface Recipe { ingredients: string[], steps: string[], link: string | null }
interface Dish {
  id: string
  title: string
  recipe: Recipe | null
}
interface Board {
  id: string
  columns: { dishes: Dish[] }[]
}

const INGREDIENTS = ['1 Dose Kichererbsen', '200 g Spinat', '2 EL Tahini']
const STEPS = ['Zwiebeln anbraten.', 'Kichererbsen dazu, zehn Minuten köcheln.', 'Mit Tahini abschmecken.']

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

async function addDish(caller: Caller, title: string): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title, placeholder: 'bowl' })
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

async function setRecipe(caller: Caller, dishId: string, recipe: unknown): Promise<Dish> {
  const res = await editDish(caller, dishId, { recipe })
  expect(res.status, await res.clone().text()).toBe(200)
  return res.json()
}

// The Dish as the Board shows it now.
async function onBoard(caller: Caller, dishId: string): Promise<Dish | undefined> {
  return (await landingBoard(caller)).columns.flatMap(c => c.dishes).find(d => d.id === dishId)
}

async function searched(caller: Caller, q: string, dishId: string): Promise<Dish | undefined> {
  const board = await landingBoard(caller)
  const res = await caller.fetch(`/api/boards/${board.id}/dishes?q=${encodeURIComponent(q)}`)
  expect(res.status).toBe(200)
  return ((await res.json()) as { dishes: Dish[] }).dishes.find(d => d.id === dishId)
}

test('a new Dish has no Recipe', async () => {
  const ada = await signIn(ALLOWLISTED[0])

  const dish = await addDish(ada, 'Rezeptlos')

  expect(dish.recipe).toBeNull()
  expect((await onBoard(ada, dish.id))!.recipe).toBeNull()
})

test('a Recipe set through the Dish edit is read back in its order, on the Board and in search results', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Kichererbsen-Curry mit Rezept')

  const edited = await setRecipe(ada, dish.id, { ingredients: INGREDIENTS, steps: STEPS })

  expect(edited.recipe).toEqual({ ingredients: INGREDIENTS, steps: STEPS, link: null })
  expect(edited.title).toBe('Kichererbsen-Curry mit Rezept')
  expect(await onBoard(ada, dish.id)).toEqual(edited)
  expect(await searched(ada, 'Kichererbsen-Curry mit Rezept', dish.id)).toEqual(edited)
})

test('an edit replaces the Recipe as a whole: lines changed, removed and put in a new order', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Umgestellt')
  await setRecipe(ada, dish.id, { ingredients: INGREDIENTS, steps: STEPS })

  const edited = await setRecipe(ada, dish.id, {
    ingredients: ['2 EL Tahini', '1 Glas Kichererbsen'],
    steps: ['Mit Tahini abschmecken.', 'Zwiebeln anbraten.', 'Servieren.'],
  })

  expect(edited.recipe).toEqual({
    ingredients: ['2 EL Tahini', '1 Glas Kichererbsen'],
    steps: ['Mit Tahini abschmecken.', 'Zwiebeln anbraten.', 'Servieren.'],
    link: null,
  })
  expect((await onBoard(ada, dish.id))!.recipe).toEqual(edited.recipe)
})

test('a Recipe with only Ingredients, or only Steps, is fine', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Halbes Rezept')

  expect((await setRecipe(ada, dish.id, { ingredients: INGREDIENTS, steps: [] })).recipe).toEqual({ ingredients: INGREDIENTS, steps: [], link: null })
  expect((await setRecipe(ada, dish.id, { ingredients: [], steps: STEPS })).recipe).toEqual({ ingredients: [], steps: STEPS, link: null })
})

test('a Recipe is cleared with null, or with nothing left in it', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Wieder leer')

  await setRecipe(ada, dish.id, { ingredients: INGREDIENTS, steps: STEPS })
  expect((await setRecipe(ada, dish.id, null)).recipe).toBeNull()
  expect((await onBoard(ada, dish.id))!.recipe).toBeNull()

  await setRecipe(ada, dish.id, { ingredients: INGREDIENTS, steps: STEPS })
  expect((await setRecipe(ada, dish.id, { ingredients: [], steps: ['  '] })).recipe).toBeNull()
  expect((await onBoard(ada, dish.id))!.recipe).toBeNull()
})

test('editing other fields leaves the Recipe as it is', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Nur der Titel')
  await setRecipe(ada, dish.id, { ingredients: INGREDIENTS, steps: STEPS })

  const res = await editDish(ada, dish.id, { title: 'Neuer Titel, altes Rezept' })

  expect(res.status).toBe(200)
  expect((await res.json() as Dish).recipe).toEqual({ ingredients: INGREDIENTS, steps: STEPS, link: null })
})

test('lines are trimmed and empty ones dropped', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Aufgeräumt')

  const edited = await setRecipe(ada, dish.id, {
    ingredients: ['  200 g Mehl ', '', '   ', '\t3 Eier\n'],
    steps: ['', ' Alles verrühren.  ', '\n'],
  })

  expect(edited.recipe).toEqual({ ingredients: ['200 g Mehl', '3 Eier'], steps: ['Alles verrühren.'], link: null })
})

test('a Recipe at its limits is kept: 60 Ingredients of 200 characters, 40 Steps of 1000', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Randvoll')
  const ingredients = Array.from({ length: 60 }, (_, i) => `${i}`.padEnd(200, 'z'))
  const steps = Array.from({ length: 40 }, (_, i) => `${i}`.padEnd(1000, 'ß'))

  // Empty lines don't count, nor the blanks around a line.
  const edited = await setRecipe(ada, dish.id, { ingredients: ['', ...ingredients.map(line => ` ${line} `)], steps: [...steps, '  '] })

  expect(edited.recipe).toEqual({ ingredients, steps, link: null })
})

test.each([
  ['61 Ingredients', { ingredients: Array.from({ length: 61 }, (_, i) => `Zutat ${i}`), steps: [] }],
  ['an Ingredient of 201 characters', { ingredients: ['z'.repeat(201)], steps: [] }],
  ['41 Steps', { ingredients: [], steps: Array.from({ length: 41 }, (_, i) => `Schritt ${i}`) }],
  ['a Step of 1001 characters', { ingredients: [], steps: ['z'.repeat(1001)] }],
])('a Recipe over the limits is refused, and the Dish keeps the one it had: %s', async (_, recipe) => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Zu viel')
  await setRecipe(ada, dish.id, { ingredients: INGREDIENTS, steps: STEPS })

  expect((await editDish(ada, dish.id, { recipe })).status).toBe(400)

  expect((await onBoard(ada, dish.id))!.recipe).toEqual({ ingredients: INGREDIENTS, steps: STEPS, link: null })
})

test.each([
  ['lines that aren\'t text', { ingredients: [1, 2], steps: [] }],
  ['a list missing', { ingredients: INGREDIENTS }],
  ['one text instead of lines', { ingredients: 'Mehl', steps: 'Rühren' }],
])('a malformed Recipe is refused: %s', async (_, recipe) => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, 'Verformt')

  expect((await editDish(ada, dish.id, { recipe })).status).toBe(400)
})

test('a Recipe change is a "Recipe edited" event of its own, without its lines; only a change is one', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const { id: userId } = await (await ada.fetch('/api/me')).json() as { id: string }
  const board = await landingBoard(ada)
  const dish = await addDish(ada, 'Protokolliert')
  const log = await watchEvents()

  await setRecipe(ada, dish.id, { ingredients: INGREDIENTS, steps: STEPS })
  // The same Recipe again: nothing changed.
  await setRecipe(ada, dish.id, { ingredients: INGREDIENTS, steps: STEPS })
  // Another order is a change.
  await setRecipe(ada, dish.id, { ingredients: INGREDIENTS.toReversed(), steps: STEPS })
  // With the title: one event each.
  expect((await editDish(ada, dish.id, { title: 'Protokolliert und umbenannt', recipe: { ingredients: [], steps: STEPS } })).status).toBe(200)
  await setRecipe(ada, dish.id, null)

  const edited = { kind: 'recipe_edited', boardId: board.id, dishId: dish.id, userId, details: null }
  const events = await log.recorded()
  expect(events).toHaveLength(5)
  expect(events).toEqual(expect.arrayContaining([
    { kind: 'dish_edited', boardId: board.id, dishId: dish.id, userId, details: { fields: ['title'] } },
  ]))
  expect(events.filter(e => e.kind === 'recipe_edited')).toEqual([edited, edited, edited, edited])
  expect(JSON.stringify(events)).not.toContain('Kichererbsen')
})
