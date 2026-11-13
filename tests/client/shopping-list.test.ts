import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { createBoardModule } from '../../app/board/board-module'
import { createKeptBoards } from '../../app/board/kept-boards'
import { createUnsentChanges, type SendRun } from '../../app/board/unsent-changes'
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import type { ShoppingItemView } from '../../shared/shopping-list'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { memoryStore } from './memory-device-store'
import { memoryTransport } from './memory-transport'

// Seam 4 once more: the Shopping List through the Board module (spec #526,
// ticket #534). The list by group, "Sonstiges" first and ticked lines last,
// each Dish group with its Dish as it is now or its title as last known; the
// writes, optimistic and rolled back when refused; and, without a
// connection, Unsent Changes that are kept, sent with their time and dropped
// (quietly for an item gone meanwhile).

function dish(id: string, ingredients: string[] = []): DishView {
  return { id, code: `c${id}`, title: `Titel ${id}`, source: null, creator: null, caption: null, playableVideo: null, recipe: ingredients.length ? { ingredients, steps: [], link: null } : null, recipeSearch: null, imageUrl: `/images/${id}.jpg`, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [], votes: [], commentCount: 0 }
}

const item = (id: string, text: string, { dishId = null as string | null, ticked = false, dishTitle = null as string | null, dishOnBoard = false, place = 0, putOn = 1 } = {}): ShoppingItemView =>
  ({ id, text, ticked, dishId, dishTitle: dishTitle ?? (dishId ? `Titel ${dishId}` : null), dishOnBoard: dishOnBoard || dishId === 'a', place, putOn })

// A Board with the Dishes a (Ingredients: Linsen, Tomaten, Zwiebel), b (no
// Recipe) and c (Penne), planned: a on Tuesday, c on Sunday of the week of
// 9 November. The list: "Sonstiges" with s1, s2 (ticked), s3; a's group with
// a1, a2 (ticked); and the group of a Dish gone from the Board (x, "Käsekuchen").
function boardFixture(): BoardView {
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
    plannedDishes: [{ id: 'p1', dishId: 'a', day: '2026-11-10', cookId: null }, { id: 'p2', dishId: 'c', day: '2026-11-15', cookId: null }],
    shoppingItems: [
      item('s1', 'Hafermilch'),
      item('s2', 'Klopapier', { ticked: true, place: 1 }),
      item('s3', 'Spülmittel', { place: 2 }),
      item('a1', 'Linsen', { dishId: 'a' }),
      item('a2', 'Tomaten', { dishId: 'a', ticked: true, place: 1 }),
      item('x1', 'Cashews', { dishId: 'x', dishTitle: 'Käsekuchen' }),
    ],
    asOperator: false,
    columns: [
      { id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a', ['Linsen', 'Tomaten', 'Zwiebel']), dish('b'), dish('c', ['Penne'])] },
      { id: 'gekocht', name: 'Gekocht', subtitle: null, isGekocht: true, dishes: [] },
    ],
  }
}

function phone(shape: (board: BoardView) => void = () => {}) {
  const fixture = boardFixture()
  shape(fixture)
  return phoneOn(memoryTransport(fixture))
}

function phoneOn(fake: ReturnType<typeof memoryTransport>, store = memoryStore()) {
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'me' })
  const module = createBoardModule(board, fake.transport, { unsent })
  // The list as the screen shows it: each group's title and lines.
  const shown = () => module.shoppingList().map(g => [g.title, g.items.map(i => i.text)])
  const onServer = () => fake.server.shoppingItems.map(i => i.text)
  return { fake, store, board, unsent, module, shown, onServer }
}

async function answerAgain(fake: { setAnswers: (mode: 'answering') => void }) {
  await new Promise(resolve => setTimeout(resolve, 0))
  fake.setAnswers('answering')
}

const asRun = (outcome: Awaited<ReturnType<ReturnType<typeof createUnsentChanges>['send']>>) => outcome as SendRun
const sync = (module: ReturnType<typeof phone>['module'], fake: ReturnType<typeof memoryTransport>) =>
  module.sync(() => Promise.resolve(structuredClone(fake.server)))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T11:00:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
})

// ---- The list by group ----

test('the list is "Sonstiges" first, then the Dish groups in order, open lines first and ticked ones at the bottom', () => {
  const { shown } = phone()

  expect(shown()).toEqual([
    [null, ['Hafermilch', 'Spülmittel', 'Klopapier']],
    ['Titel a', ['Linsen', 'Tomaten']],
    ['Käsekuchen', ['Cashews']],
  ])
})

test('a group shows its Dish as it is now while it is on the Board, else its title as last known', () => {
  const { board, module } = phone()
  board.value!.columns[0]!.dishes[0]!.title = 'Omas Linsensuppe'

  const [sonstiges, soup, gone] = module.shoppingList()

  expect(sonstiges).toMatchObject({ dishId: null, title: null, dish: null })
  expect(soup).toMatchObject({ dishId: 'a', title: 'Omas Linsensuppe' })
  expect(soup!.dish?.imageUrl).toBe('/images/a.jpg')
  expect(gone).toMatchObject({ dishId: 'x', title: 'Käsekuchen', dish: null })
})

test('an empty list has no groups', () => {
  const { module } = phone((board) => {
    board.shoppingItems = []
  })
  expect(module.shoppingList()).toEqual([])
  expect(module.tickedCount()).toBe(0)
})

test('a Board kept before the Shopping List reads with an empty list', async () => {
  const store = memoryStore()
  const old = boardFixture() as Partial<BoardView>
  delete old.shoppingItems
  await store.boards.save('me', old as BoardView)
  const kept = createKeptBoards({ store, userId: 'me' })

  expect((await kept.board('board'))!.shoppingItems).toEqual([])
})

test('what "Auf die Einkaufsliste" offers is the Dish\'s Ingredients, none for a Dish without', () => {
  const { module } = phone()
  expect(module.ingredientsToPutOn('a')).toEqual(['Linsen', 'Tomaten', 'Zwiebel'])
  expect(module.ingredientsToPutOn('b')).toEqual([])
  expect(module.ingredientsToPutOn('nope')).toEqual([])
})

// ---- Writes ----

test('typing an item puts it at the end of "Sonstiges" at once, and sends it with the id the device made', async () => {
  const { fake, module, shown, onServer, board } = phone()

  const result = module.addShoppingItem('  Reis ')!

  expect(shown()[0]).toEqual([null, ['Hafermilch', 'Spülmittel', 'Reis', 'Klopapier']])
  expect(await result.settled).toEqual({ count: 1 })
  expect(onServer()).toContain('Reis')
  expect(fake.server.shoppingItems.find(i => i.text === 'Reis')!.id).toBe(board.value!.shoppingItems.find(i => i.text === 'Reis')!.id)
  expect(module.addShoppingItem('   ')).toBeNull()
})

test('the first item of an empty "Sonstiges" goes before the Dish groups', () => {
  const { module, shown } = phone((board) => {
    board.shoppingItems = board.shoppingItems.filter(i => i.dishId !== null)
  })
  module.addShoppingItem('Reis')
  expect(shown().map(([title]) => title)).toEqual([null, 'Titel a', 'Käsekuchen'])
})

test('an item the server refuses (the list full) is taken back, with a notice', async () => {
  const { fake, module, shown } = phone()
  fake.failNext('addShoppingItem', 409)

  const result = module.addShoppingItem('Reis')!

  expect(await result.settled).toEqual({ count: 0, notice: 'shoppingFull' })
  expect(shown()[0]![1]).not.toContain('Reis')
})

test('ticking sinks a line to the bottom of its group at once; unticking brings it back', async () => {
  const { module, shown, fake } = phone()

  await module.tickShoppingItem('s1', true)!.settled
  expect(shown()[0]).toEqual([null, ['Spülmittel', 'Hafermilch', 'Klopapier']])
  expect(fake.server.shoppingItems.find(i => i.id === 's1')!.ticked).toBe(true)
  expect(module.tickedCount()).toBe(3)

  await module.tickShoppingItem('s2', false)!.settled
  expect(shown()[0]).toEqual([null, ['Klopapier', 'Spülmittel', 'Hafermilch']])
  expect(module.tickShoppingItem('s2', false)).toBeNull()
})

test('a tick the server refuses goes back, with a notice', async () => {
  const { fake, module, board } = phone()
  fake.failNext('changeShoppingItem', 500)
  fake.failNext('changeShoppingItem', 400)

  expect(await module.tickShoppingItem('s1', true)!.settled).toEqual({ count: 0, notice: 'shoppingFailed' })
  expect(board.value!.shoppingItems.find(i => i.id === 's1')!.ticked).toBe(false)
})

test('changing a line\'s text shows at once and is sent; refused, it goes back', async () => {
  const { fake, module, board } = phone()
  const text = (id: string) => board.value!.shoppingItems.find(i => i.id === id)!.text

  await module.changeShoppingItem('s1', '2 Hafermilch')!.settled
  expect(text('s1')).toBe('2 Hafermilch')
  expect(fake.server.shoppingItems.find(i => i.id === 's1')!.text).toBe('2 Hafermilch')

  fake.failNext('changeShoppingItem', 400)
  expect(await module.changeShoppingItem('s1', 'Sojamilch')!.settled).toMatchObject({ notice: 'shoppingFailed' })
  expect(text('s1')).toBe('2 Hafermilch')
  expect(module.changeShoppingItem('s1', '  ')).toBeNull()
  expect(module.changeShoppingItem('s1', '2 Hafermilch')).toBeNull()
})

test('a change or tick of an item another Member deleted meanwhile takes it off the list, with no notice', async () => {
  const { fake, module, board } = phone()
  fake.deleteShoppingItemElsewhere('s1')
  fake.deleteShoppingItemElsewhere('s3')

  expect(await module.tickShoppingItem('s1', true)!.settled).toEqual({ count: 0 })
  expect(await module.changeShoppingItem('s3', 'Neu')!.settled).toEqual({ count: 0 })
  expect(board.value!.shoppingItems.map(i => i.id)).toEqual(['s2', 'a1', 'a2', 'x1'])
})

test('deleting a line takes it off at once; "Rückgängig" brings it back in its place, as it was', async () => {
  const { fake, module, shown, onServer } = phone()

  const result = module.deleteShoppingItem('a2')!
  expect(shown()[1]).toEqual(['Titel a', ['Linsen']])
  await result.settled
  expect(onServer()).not.toContain('Tomaten')

  const back = result.undo!()!
  expect(shown()[1]).toEqual(['Titel a', ['Linsen', 'Tomaten']])
  expect(await back.settled).toEqual({ count: 1 })
  expect(fake.server.shoppingItems.find(i => i.id === 'a2')).toMatchObject({ ticked: true, dishId: 'a' })
})

test('a group goes when its last line does', async () => {
  const { module, shown } = phone()
  await module.deleteShoppingItem('x1')!.settled
  expect(shown().map(([title]) => title)).toEqual([null, 'Titel a'])
})

test('a delete the server refuses puts the line back; one already gone counts as deleted', async () => {
  const { fake, module, board } = phone()
  fake.failNext('deleteShoppingItem', 400)
  expect(await module.deleteShoppingItem('s1')!.settled).toMatchObject({ notice: 'shoppingFailed' })
  expect(board.value!.shoppingItems[0]!.id).toBe('s1')

  fake.deleteShoppingItemElsewhere('s3')
  expect(await module.deleteShoppingItem('s3')!.settled).toEqual({ count: 0 })
  expect(board.value!.shoppingItems.some(i => i.id === 's3')).toBe(false)
})

test('"Erledigte entfernen" clears every ticked line at once; "Rückgängig" brings them back, with one another Member ticked meanwhile', async () => {
  const { fake, module, shown, onServer } = phone()
  fake.tickShoppingItemElsewhere('s3')

  const result = module.clearTicked()!
  expect(result.count).toBe(2)
  expect(shown()).toEqual([[null, ['Hafermilch', 'Spülmittel']], ['Titel a', ['Linsen']], ['Käsekuchen', ['Cashews']]])
  await result.settled
  expect(onServer()).toEqual(['Hafermilch', 'Linsen', 'Cashews'])

  await result.undo!()!.settled
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(onServer()).toEqual(['Hafermilch', 'Klopapier', 'Spülmittel', 'Linsen', 'Tomaten', 'Cashews'])
  expect(shown()[0]).toEqual([null, ['Hafermilch', 'Spülmittel', 'Klopapier']])
})

test('"Erledigte entfernen" does nothing with nothing ticked', () => {
  const { module } = phone((board) => {
    board.shoppingItems.forEach((i) => {
      i.ticked = false
    })
  })
  expect(module.clearTicked()).toBeNull()
})

test('putting a Dish on adds the chosen lines to the end of its group at once, and sends them in order', async () => {
  const { fake, module, shown } = phone()

  const result = module.putDishOn('a', [{ line: 0, text: 'Linsen' }, { line: 2, text: 'Zwiebel' }])!

  expect(result.count).toBe(2)
  expect(shown()[1]).toEqual(['Titel a', ['Linsen', 'Linsen', 'Zwiebel', 'Tomaten']])
  expect(await result.settled).toEqual({ count: 2 })
  expect(fake.sent).toContain('putDishOnShoppingList a Linsen|Zwiebel')
})

test('a Dish put on twice reads A, A, B, B with the ticked line last, and its group counts two put-ons', async () => {
  const { module } = phone()
  expect(module.shoppingList().map(g => g.times)).toEqual([1, 1, 1])

  await module.putDishOn('a', [{ line: 0, text: 'Linsen' }, { line: 1, text: 'Tomaten' }])!.settled

  const group = module.shoppingList()[1]!
  expect(group.items.map(i => [i.text, i.putOn, i.ticked])).toEqual([['Linsen', 1, false], ['Linsen', 2, false], ['Tomaten', 2, false], ['Tomaten', 1, true]])
  expect(group.times).toBe(2)
})

test('a group\'s lines keep their Recipe place whatever order they came in', () => {
  const { module } = phone((board) => {
    board.shoppingItems.push(item('a3', 'Zwiebel', { dishId: 'a', place: 2 }), item('a4', 'Salz', { dishId: 'a', place: 0, putOn: 2 }))
  })
  expect(module.shoppingList()[1]!.items.map(i => i.text)).toEqual(['Linsen', 'Salz', 'Zwiebel', 'Tomaten'])
})

test('a line typed into "Sonstiges" has the place after the last one typed, and was put on once', () => {
  const { module, board } = phone()
  module.addShoppingItem('Reis')
  expect(board.value!.shoppingItems.find(i => i.text === 'Reis')).toMatchObject({ place: 3, putOn: 1 })
})

test('taking a Dish put-on back takes exactly its items off at once and on the server, and its group counts one put-on again', async () => {
  const { module, shown, onServer } = phone()
  const put = module.putDishOn('a', [{ line: 0, text: 'Linsen' }, { line: 2, text: 'Zwiebel' }])!
  await put.settled
  expect(module.shoppingList()[1]!.times).toBe(2)

  const back = put.undo!()!

  expect(shown()[1]).toEqual(['Titel a', ['Linsen', 'Tomaten']])
  expect(module.shoppingList()[1]!.times).toBe(1)
  expect(back.undo).toBeUndefined()
  expect(await back.settled).toEqual({ count: 2 })
  expect(onServer()).toEqual(['Hafermilch', 'Klopapier', 'Spülmittel', 'Linsen', 'Tomaten', 'Cashews'])
})

test('a take-back the server refuses puts the items back, with a notice', async () => {
  const { fake, module, shown } = phone()
  const put = module.putDishOn('a', [{ line: 0, text: 'Linsen' }])!
  await put.settled
  fake.failNext('takeBackShoppingItems', 500)

  expect(await put.undo!()!.settled).toEqual({ count: 0, notice: 'shoppingFailed' })

  expect(shown()[1]).toEqual(['Titel a', ['Linsen', 'Linsen', 'Tomaten']])
})

test('putting a week on can be taken back: just the items it put on go', async () => {
  const { module, shown, onServer } = phone()
  const week = (await module.putWeekOn('2026-11-09'))!
  expect(week.dishes).toBe(1)
  expect(shown().map(([title]) => title)).toEqual([null, 'Titel a', 'Käsekuchen', 'Titel c'])

  await week.undo!()!.settled

  expect(shown().map(([title]) => title)).toEqual([null, 'Titel a', 'Käsekuchen'])
  expect(onServer()).not.toContain('Penne')
  expect(await module.putWeekOn('2026-11-09')).toMatchObject({ dishes: 1 })
})

test('a week with nothing to put on, or kept for later, has nothing to take back', async () => {
  const { module, fake } = phone()
  await module.putWeekOn('2026-11-09')
  expect((await module.putWeekOn('2026-11-09'))!.undo).toBeUndefined()
  fake.setAnswers('none')
  expect((await module.putWeekOn('2026-11-09'))!.undo).toBeUndefined()
})

test('a Dish planned twice in the week goes on twice, its group counting two put-ons', async () => {
  const { module } = phone((board) => {
    board.plannedDishes.push({ id: 'p3', dishId: 'c', day: '2026-11-13', cookId: null })
  })
  expect(await module.putWeekOn('2026-11-09')).toMatchObject({ dishes: 1 })
  const group = module.shoppingList().find(g => g.dishId === 'c')!
  expect(group.items.map(i => [i.text, i.putOn])).toEqual([['Penne', 1], ['Penne', 2]])
  expect(group.times).toBe(2)
})

test('a Dish put on twice, offline, with its take-back is two Unsent Changes that go out in order', async () => {
  const { fake, module, unsent, onServer } = phone()
  fake.setAnswers('none')
  const put = module.putDishOn('c', [{ line: 0, text: 'Penne' }])!
  await put.settled

  const back = put.undo!()!
  expect(await back.settled).toEqual({ count: 1, unsent: true })

  expect(module.shoppingList().some(g => g.dishId === 'c')).toBe(false)
  expect(unsent.changes.value.map(c => c.kind)).toEqual(['shopDish', 'shopTakeBack'])
  await answerAgain(fake)
  fake.sent.length = 0
  expect(asRun(await unsent.send())).toMatchObject({ sent: 2, dropped: [], emptied: true })
  expect(fake.sent).toEqual(['putDishOnShoppingList c Penne', expect.stringMatching(/^takeBackShoppingItems /)])
  expect(onServer()).not.toContain('Penne')
})

test('a take-back kept as an Unsent Change shows again on the reopened Board', async () => {
  const { fake, module, store, unsent } = phone()
  fake.setAnswers('none')
  const put = module.putDishOn('a', [{ line: 0, text: 'Linsen' }])!
  await put.settled
  await put.undo!()!.settled
  await unsent.saved()

  const reopened = phoneOn(fake, store)
  await reopened.module.layOverUnsent()

  expect(reopened.shown()[1]).toEqual(['Titel a', ['Linsen', 'Tomaten']])
})

test('a Dish put on for the first time is a new group after the others', async () => {
  const { module, shown } = phone()
  await module.putDishOn('c', [{ line: 0, text: 'Penne' }])!.settled
  expect(shown().map(([title]) => title)).toEqual([null, 'Titel a', 'Käsekuchen', 'Titel c'])
})

test('a Dish without Ingredients, not on the Board, or with no line chosen is not put on', () => {
  const { module } = phone()
  expect(module.putDishOn('b', [{ line: 0, text: 'Mehl' }])).toBeNull()
  expect(module.putDishOn('x', [{ line: 0, text: 'Cashews' }])).toBeNull()
  expect(module.putDishOn('a', [{ line: 0, text: ' ' }])).toBeNull()
})

test('a Dish archived meanwhile is taken back off the list, with a notice', async () => {
  const { fake, module, shown } = phone()
  fake.deleteDishElsewhere('c')
  expect(await module.putDishOn('c', [{ line: 0, text: 'Penne' }])!.settled).toEqual({ count: 0, notice: 'dishGone' })
  expect(shown().map(([title]) => title)).toEqual([null, 'Titel a', 'Käsekuchen'])
})

test('putting a week on shows its items once the server answers, and says how many Dishes went on', async () => {
  const { module, shown } = phone()

  expect(await module.putWeekOn('2026-11-09')).toMatchObject({ dishes: 1 })
  expect(shown().map(([title]) => title)).toEqual([null, 'Titel a', 'Käsekuchen', 'Titel c'])
  // Everything is on already.
  expect(await module.putWeekOn('2026-11-09')).toEqual({ dishes: 0 })
})

test('another Member\'s change to the list arrives with the Board sync', async () => {
  const { fake, module, shown } = phone()
  await fake.transport.addShoppingItem('board', { id: 'n1', text: 'Reis' })
  fake.tickShoppingItemElsewhere('s1')

  expect(await sync(module, fake)).toBe(true)

  expect(shown()[0]).toEqual([null, ['Spülmittel', 'Reis', 'Hafermilch', 'Klopapier']])
})

// ---- Offline ----

test('a line typed without a connection shows at once, is kept, and is sent with the time it was made', async () => {
  const { fake, module, unsent, onServer } = phone()
  fake.setAnswers('none')

  const result = module.addShoppingItem('Reis')!
  const ended = await result.settled
  const tapped = new Date().toISOString()

  expect(ended).toEqual({ count: 1, unsent: true })
  expect(module.shoppingList()[0]!.items.find(i => i.text === 'Reis')!.unsent).toBe(true)
  expect(unsent.changes.value.map(c => c.kind)).toEqual(['shopAdd'])
  expect(onServer()).not.toContain('Reis')

  await answerAgain(fake)
  expect(asRun(await unsent.send())).toMatchObject({ sent: 1, emptied: true })
  expect(onServer()).toContain('Reis')
  expect(fake.shoppingMadeAt).toEqual([tapped])
  expect(module.shoppingList()[0]!.items.find(i => i.text === 'Reis')!.unsent).toBe(false)
})

test('every write made without a connection is an Unsent Change, and they go out in order', async () => {
  const { fake, module, unsent, onServer } = phone()
  fake.setAnswers('none')
  await module.addShoppingItem('Reis')!.settled
  await module.changeShoppingItem('s1', '2 Hafermilch')!.settled
  await module.tickShoppingItem('s3', true)!.settled
  await module.deleteShoppingItem('x1')!.settled
  await module.putDishOn('c', [{ line: 0, text: 'Penne' }])!.settled
  await module.clearTicked()!.settled
  expect(await module.putWeekOn('2026-11-09')).toEqual({ dishes: 0, unsent: true })

  expect(unsent.changes.value.map(c => c.kind)).toEqual(['shopAdd', 'shopText', 'shopTick', 'shopDelete', 'shopDish', 'shopClear', 'shopWeek'])

  await answerAgain(fake)
  expect(asRun(await unsent.send())).toMatchObject({ sent: 7, dropped: [], emptied: true })
  expect(onServer()).toEqual(['2 Hafermilch', 'Reis', 'Linsen', 'Penne'])
})

test('while changes wait, a new list change joins them without trying the network', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('none')
  await module.addShoppingItem('Reis')!.settled
  fake.setAnswers('answering')
  fake.sent.length = 0

  expect(await module.tickShoppingItem('s1', true)!.settled).toEqual({ count: 1, unsent: true })
  expect(fake.sent.filter(s => s.startsWith('changeShoppingItem'))).toEqual([])
  expect(unsent.count.value).toBe(2)
})

test('Unsent Changes of the list survive a closed app and show again on the reopened Board', async () => {
  const { fake, module, store, unsent } = phone()
  fake.setAnswers('none')
  await module.addShoppingItem('Reis')!.settled
  await module.tickShoppingItem('s1', true)!.settled
  await module.deleteShoppingItem('s3')!.settled
  await unsent.saved()

  const reopened = phoneOn(fake, store)
  await reopened.module.layOverUnsent()

  expect(reopened.shown()[0]).toEqual([null, ['Reis', 'Hafermilch', 'Klopapier']])
})

test('a Board sync while list changes are unsent keeps them on top of what the server says', async () => {
  const { fake, module, shown } = phone()
  fake.setAnswers('none')
  await module.addShoppingItem('Reis')!.settled
  await module.deleteShoppingItem('s3')!.settled
  await fake.transport.putDishOnShoppingList('board', { dishId: 'c', items: [{ id: 'c1', text: 'Penne', line: 0 }] }).catch(() => {})
  fake.setAnswers('answering')
  fake.server.shoppingItems.push(item('n9', 'Brot'))

  expect(await sync(module, fake)).toBe(true)

  expect(shown()[0]).toEqual([null, ['Hafermilch', 'Brot', 'Reis', 'Klopapier']])
})

test('an offline change to an item gone meanwhile is dropped quietly; a Dish put on that went is dropped and named', async () => {
  const { fake, module, unsent, board } = phone()
  fake.setAnswers('none')
  await module.tickShoppingItem('s1', true)!.settled
  await module.changeShoppingItem('s3', 'Neu')!.settled
  await module.deleteShoppingItem('a1')!.settled
  await module.putDishOn('c', [{ line: 0, text: 'Penne' }])!.settled
  await answerAgain(fake)
  for (const id of ['s1', 's3', 'a1']) fake.deleteShoppingItemElsewhere(id)
  fake.deleteDishElsewhere('c')

  const run = asRun(await unsent.send())

  expect(unsent.count.value).toBe(0)
  expect(run.dropped.map(c => c.kind)).toEqual(['shopDish'])
  expect(unsent.takeDropped().map(c => c.label)).toEqual(['Titel c'])
  void module.droppedChanges(run.dropped)
  expect(board.value!.shoppingItems.some(i => i.dishId === 'c')).toBe(false)
})

test('an offline line the server refuses (the list full) is dropped, named, and taken off', async () => {
  const { fake, module, unsent, board } = phone()
  fake.setAnswers('none')
  await module.addShoppingItem('Reis')!.settled
  await answerAgain(fake)
  fake.failNext('addShoppingItem', 409)

  const run = asRun(await unsent.send())

  expect(run.dropped.map(c => c.label)).toEqual(['Reis'])
  void module.droppedChanges(run.dropped)
  expect(board.value!.shoppingItems.some(i => i.text === 'Reis')).toBe(false)
})

test('a line whose answer was lost, sent again, is on the list once', async () => {
  const { fake, module, unsent, onServer } = phone()
  fake.setAnswers('lost')
  await module.addShoppingItem('Reis')!.settled
  expect(onServer().filter(t => t === 'Reis')).toHaveLength(1)

  await answerAgain(fake)
  await unsent.send()

  expect(onServer().filter(t => t === 'Reis')).toHaveLength(1)
})
