import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule, WriteFailed } from '../../app/board/board-module'
import { createKeptBoards } from '../../app/board/kept-boards'
import { createUnsentChanges, type SendRun } from '../../app/board/unsent-changes'
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { memoryStore } from './memory-device-store'
import { memoryTransport } from './memory-transport'

// Seam 4 once more: a Dish's Recipe through the Board module (spec #492,
// ticket #496). Edited while malkochen doesn't answer, it shows at once, is
// kept on the device and sent as the Recipe, whole, once malkochen answers;
// it is the last arrival that wins. Another Member's Recipe reaches an open
// Dish with the Board's sync, and the Recipe is kept on the device with the
// Board.

const me = { id: 'me', name: 'Ich', image: null }

function dish(id: string): DishView {
  return { id, code: `c${id}`, title: `Titel ${id}`, source: null, creator: null, caption: null, playableVideo: null, recipe: null, recipeSearch: null, imageUrl: null, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [], votes: [], commentCount: 0 }
}

// A Board with Ideen (a, b), where `b` has a Recipe found at a blog, and
// Gekocht (empty).
function boardFixture(): BoardView {
  const b = dish('b')
  b.recipe = { ingredients: ['Mehl'], steps: ['Backen'], link: 'https://blog.example/b' }
  return {
    id: 'board',
    slug: 'kochclub',
    name: 'Kochclub',
    emoji: '🍜',
    isOwner: true,
    permissions: ALL_PERMISSIONS,
    version: 0,
    inviteToken: 'token',
    members: [],
    newDishIds: [],
    newInHistoryDishIds: [],
    asOperator: false,
    columns: [
      { id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a'), b] },
      { id: 'gekocht', name: 'Gekocht', subtitle: null, isGekocht: true, dishes: [] },
    ],
  }
}

function phone(fake = memoryTransport(boardFixture()), store = memoryStore()) {
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'me' })
  const module = createBoardModule(board, fake.transport, { unsent })
  const dishOf = (id: string) => board.value!.columns.flatMap(c => c.dishes).find(d => d.id === id)!
  const onServer = (id: string) => fake.server.columns.flatMap(c => c.dishes).find(d => d.id === id)!
  return { fake, store, board, unsent, module, dishOf, onServer }
}

async function answerAgain(fake: { setAnswers: (mode: 'answering') => void }) {
  await new Promise(resolve => setTimeout(resolve, 0))
  fake.setAnswers('answering')
}

const asRun = (outcome: Awaited<ReturnType<ReturnType<typeof createUnsentChanges>['send']>>) => outcome as SendRun

const lines = { ingredients: ['  200 g Mehl ', '', '2 Eier'], steps: ['Alles verrühren.'] }

test('a Recipe saved online is the Dish\'s as the server saved it', async () => {
  const { fake, module, dishOf, unsent } = phone()

  const result = await module.editDish('a', { recipe: { ingredients: ['200 g Mehl', '2 Eier'], steps: ['Alles verrühren.'] } })

  expect(result).not.toHaveProperty('unsent')
  expect(dishOf('a').recipe).toEqual({ ingredients: ['200 g Mehl', '2 Eier'], steps: ['Alles verrühren.'], link: null })
  expect(fake.sent).toEqual(['editDish a'])
  expect(unsent.count.value).toBe(0)
  expect(module.hasUnsentRecipe('a')).toBe(false)
})

test('a Recipe edit that gets no answer shows at once, is unsent, and is sent as the Recipe alone', async () => {
  const { fake, module, unsent, dishOf, onServer } = phone()
  fake.setAnswers('none')

  const result = await module.editDish('a', { recipe: lines })

  expect(result).toMatchObject({ unsent: true })
  expect(dishOf('a').recipe).toEqual({ ingredients: ['200 g Mehl', '2 Eier'], steps: ['Alles verrühren.'], link: null })
  expect(unsent.changes.value).toMatchObject([{ kind: 'recipe', dishId: 'a', label: 'Titel a', recipe: { ingredients: ['200 g Mehl', '2 Eier'], steps: ['Alles verrühren.'] } }])
  expect(module.hasUnsentRecipe('a')).toBe(true)
  expect(module.hasUnsentRecipe('b')).toBe(false)
  expect(onServer('a').recipe).toBeNull()

  await answerAgain(fake)
  fake.sent.length = 0
  expect(asRun(await unsent.send())).toMatchObject({ sent: 1, emptied: true })
  expect(fake.sent).toEqual(['editDish a'])
  expect(onServer('a').recipe).toEqual({ ingredients: ['200 g Mehl', '2 Eier'], steps: ['Alles verrühren.'], link: null })
  expect(module.hasUnsentRecipe('a')).toBe(false)
})

test('a Recipe edit survives the app being opened again, and arrives from there', async () => {
  const first = phone()
  first.fake.setAnswers('none')
  await first.module.editDish('a', { recipe: lines })
  await first.unsent.saved()

  const second = phone(first.fake, first.store)
  await second.unsent.ready
  await second.module.layOverUnsent()
  expect(second.dishOf('a').recipe).toMatchObject({ ingredients: ['200 g Mehl', '2 Eier'], steps: ['Alles verrühren.'] })
  expect(second.module.hasUnsentRecipe('a')).toBe(true)

  await answerAgain(second.fake)
  expect(asRun(await second.unsent.send())).toMatchObject({ sent: 1 })
  expect(second.onServer('a').recipe?.steps).toEqual(['Alles verrühren.'])
})

test('the link a Recipe was found at stays through an edit made offline, and the edit is the whole Recipe', async () => {
  const { fake, module, unsent, dishOf, onServer } = phone()
  fake.setAnswers('none')

  await module.editDish('b', { recipe: { ingredients: ['Zucker'], steps: [] } })

  expect(dishOf('b').recipe).toEqual({ ingredients: ['Zucker'], steps: [], link: 'https://blog.example/b' })
  await answerAgain(fake)
  await unsent.send()
  expect(onServer('b').recipe).toEqual({ ingredients: ['Zucker'], steps: [], link: 'https://blog.example/b' })
})

test('a null edit clears the Recipe, offline and online', async () => {
  const { fake, module, unsent, dishOf, onServer } = phone()
  fake.setAnswers('none')

  await module.editDish('b', { recipe: null })
  expect(dishOf('b').recipe).toBeNull()
  expect(unsent.changes.value).toMatchObject([{ kind: 'recipe', dishId: 'b', recipe: null }])

  await answerAgain(fake)
  await unsent.send()
  expect(onServer('b').recipe).toBeNull()

  await module.editDish('a', { recipe: { ingredients: ['x'], steps: [] } })
  await module.editDish('a', { recipe: { ingredients: ['', ' '], steps: [] } })
  expect(dishOf('a').recipe).toBeNull()
})

test('two empty lists are no Recipe when kept either', async () => {
  const { fake, module, dishOf } = phone()
  fake.setAnswers('none')
  await module.editDish('b', { recipe: { ingredients: [' '], steps: [''] } })
  expect(dishOf('b').recipe).toBeNull()
})

test('while changes wait, a Recipe edit joins them, and the last one sent wins', async () => {
  const { fake, module, unsent, dishOf, onServer } = phone()
  fake.setAnswers('none')
  await module.editDish('a', { title: 'Neu' })
  await module.editDish('a', { recipe: { ingredients: ['Erst'], steps: [] } })
  await module.editDish('a', { recipe: { ingredients: ['Dann'], steps: [] } })
  expect(unsent.changes.value.map(c => c.kind)).toEqual(['title', 'recipe', 'recipe'])
  expect(dishOf('a').recipe?.ingredients).toEqual(['Dann'])

  await answerAgain(fake)
  fake.sent.length = 0
  expect(asRun(await unsent.send())).toMatchObject({ sent: 3, emptied: true })
  expect(onServer('a').recipe?.ingredients).toEqual(['Dann'])
  expect(onServer('a').title).toBe('Neu')
})

test('a Recipe edit after a Dish added offline is kept and goes after the add', async () => {
  const { fake, module, unsent, dishOf } = phone()
  fake.setAnswers('none')
  const added = await module.addDish('board', { title: 'Dal', placeholder: 'bowl' }, me)
  const id = added.dish.id

  const result = await module.editDish(id, { recipe: { ingredients: ['Linsen'], steps: ['Kochen.'] } })
  expect(result).toMatchObject({ unsent: true })
  expect(dishOf(id).recipe).toMatchObject({ ingredients: ['Linsen'] })
  expect(unsent.changes.value.map(c => c.kind)).toEqual(['add', 'recipe'])

  // Anything else is still refused until the Dish has arrived.
  await expect(module.editDish(id, { recipe: { ingredients: [], steps: [] }, creator: 'Jemand' })).rejects.toBeInstanceOf(WriteFailed)

  await answerAgain(fake)
  fake.sent.length = 0
  expect(asRun(await unsent.send())).toMatchObject({ sent: 2, emptied: true })
  expect(fake.sent[0]).toMatch(/^addDishLate/)
  expect(fake.sent[1]).toMatch(/^editDish /)
  const arrived = fake.server.columns.flatMap(c => c.dishes).find(d => d.title === 'Dal')!
  expect(arrived.recipe).toMatchObject({ ingredients: ['Linsen'], steps: ['Kochen.'] })
})

test('a Recipe edit the server refuses is dropped, and the Member is told which Dish', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('none')
  await module.editDish('a', { recipe: { ingredients: ['x'], steps: [] } })
  await answerAgain(fake)
  fake.failNext('editDish', 403)

  expect(asRun(await unsent.send())).toMatchObject({ sent: 0, dropped: [{ kind: 'recipe', dishId: 'a' }], emptied: true })

  expect(unsent.count.value).toBe(0)
  expect(unsent.takeDropped()).toMatchObject([{ kind: 'recipe', label: 'Titel a' }])
})

test('a Recipe edit for a Dish the server no longer has is dropped too', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('none')
  await module.editDish('a', { recipe: { ingredients: ['x'], steps: [] } })
  await answerAgain(fake)
  fake.failNext('editDish', 404)

  expect(asRun(await unsent.send())).toMatchObject({ dropped: [{ kind: 'recipe', dishId: 'a' }] })
  expect(unsent.takeDropped().map(c => c.label)).toEqual(['Titel a'])
})

test('a Recipe edit refused at once rejects, as the server would answer', async () => {
  const { fake, module, unsent } = phone()
  fake.failNext('editDish', 403)
  await expect(module.editDish('a', { recipe: { ingredients: ['x'], steps: [] } })).rejects.toMatchObject({ status: 403 })
  expect(unsent.count.value).toBe(0)
})

test('a Recipe edit together with other fields is not kept', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('none')
  await expect(module.editDish('a', { title: 'X', recipe: { ingredients: ['x'], steps: [] } })).rejects.toBeInstanceOf(WriteFailed)
  expect(unsent.count.value).toBe(0)
})

test('a Board sync keeps an unsent Recipe edit on top of what the server says', async () => {
  const { fake, module, dishOf } = phone()
  fake.setAnswers('none')
  await module.editDish('a', { recipe: { ingredients: ['Meins'], steps: [] } })
  fake.server.columns[0]!.dishes[0]!.recipe = { ingredients: ['Deren'], steps: [], link: null }

  await new Promise(resolve => setTimeout(resolve, 0))
  expect(await module.sync(() => Promise.resolve(structuredClone(fake.server)))).toBe(true)

  expect(dishOf('a').recipe?.ingredients).toEqual(['Meins'])
})

test('another Member\'s Recipe reaches the Board with the sync, and so does its removal', async () => {
  const { fake, module, dishOf } = phone()
  expect(dishOf('a').recipe).toBeNull()

  fake.server.columns[0]!.dishes[0]!.recipe = { ingredients: ['Tofu'], steps: ['Braten.'], link: null }
  expect(await module.sync(() => Promise.resolve(structuredClone(fake.server)))).toBe(true)
  expect(dishOf('a').recipe).toEqual({ ingredients: ['Tofu'], steps: ['Braten.'], link: null })

  fake.server.columns[0]!.dishes[0]!.recipe = null
  expect(await module.sync(() => Promise.resolve(structuredClone(fake.server)))).toBe(true)
  expect(dishOf('a').recipe).toBeNull()
})

test('the Recipe is kept on the device with the Board, to read offline', async () => {
  const store = memoryStore()
  const kept = createKeptBoards({ store, userId: 'me' })
  await kept.opened(boardFixture())

  const again = createKeptBoards({ store, userId: 'me' })
  const view = await again.board('board')

  expect(view?.columns[0]!.dishes[1]!.recipe).toEqual({ ingredients: ['Mehl'], steps: ['Backen'], link: 'https://blog.example/b' })
})
