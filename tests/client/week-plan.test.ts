import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { createBoardModule } from '../../app/board/board-module'
import { createKeptBoards } from '../../app/board/kept-boards'
import { createUnsentChanges, type SendRun } from '../../app/board/unsent-changes'
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import type { PlannedDishView } from '../../server/utils/week-plan'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { memoryStore } from './memory-device-store'
import { memoryTransport } from './memory-transport'

// Seam 4 once more: the Week Plan through the Board module (spec #511,
// ticket #516). The Board's Planned Dishes by day with their Dish, cook and
// cooked state; the four writes, optimistic and rolled back when refused;
// and, without a connection, Unsent Changes that are kept, sent with their
// time and dropped when they can't apply.

const MON = '2026-11-09'
const TUE = '2026-11-10'
const WED = '2026-11-11'
const THU = '2026-11-12'

function dish(id: string): DishView {
  return { id, code: `c${id}`, title: `Titel ${id}`, source: null, creator: null, caption: null, playableVideo: null, recipe: null, recipeSearch: null, imageUrl: null, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [], votes: [], commentCount: 0 }
}

const member = (id: string, name: string) => ({ id, name, image: null, isOwner: false, isYou: false })

const planned = (id: string, dishId: string, day: string, cookId: string | null = null): PlannedDishView => ({ id, dishId, day, cookId })

// A Board with Ideen (a, b), Diese Woche (c) and Gekocht (d), two Members
// (ada, linus), and the Week Plan: Monday has p1 (a) then p2 (b), Tuesday has
// p3 (c) cooked by ada.
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
    members: [member('ada', 'Ada'), member('linus', 'Linus')],
    newDishIds: [],
    newInHistoryDishIds: [],
    plannedDishes: [planned('p1', 'a', MON), planned('p2', 'b', MON), planned('p3', 'c', TUE, 'ada')],
    shoppingItems: [],
    asOperator: false,
    columns: [
      { id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a'), dish('b')] },
      { id: 'woche', name: 'Diese Woche', subtitle: null, isGekocht: false, dishes: [dish('c')] },
      { id: 'gekocht', name: 'Gekocht', subtitle: null, isGekocht: true, dishes: [dish('d')] },
    ],
  }
}

// The phone: a Board on screen and its module over `store`, against `fake`'s
// server. A second call with the same store and server is the app opened
// again. `shape` changes the Board before the server and the screen get it.
function phone(shape: (board: BoardView) => void = () => {}) {
  const fixture = boardFixture()
  shape(fixture)
  return phoneOn(memoryTransport(fixture))
}

function phoneOn(fake: ReturnType<typeof memoryTransport>, store = memoryStore()) {
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'me' })
  const module = createBoardModule(board, fake.transport, { unsent })
  // A day's Planned Dish ids, as the Week Plan shows them, and as the server has them.
  const dayOf = (day: string) => module.weekPlan([day])[day]!.map(e => e.id)
  const onServer = (day: string) => fake.server.plannedDishes.filter(p => p.day === day).map(p => p.id)
  return { fake, store, board, unsent, module, dayOf, onServer }
}

// malkochen answers again. First a beat, so the sends the module tried
// meanwhile have ended unanswered.
async function answerAgain(fake: { setAnswers: (mode: 'answering') => void }) {
  await new Promise(resolve => setTimeout(resolve, 0))
  fake.setAnswers('answering')
}

const asRun = (outcome: Awaited<ReturnType<ReturnType<typeof createUnsentChanges>['send']>>) => outcome as SendRun

beforeEach(() => {
  // Only the clock, so a Cooking is dated at Thursday noon, 12 November.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T11:00:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
})

// ---- The Week Plan by day ----

test('the Week Plan by day lists the Planned Dishes in order, each with its Dish and cook', () => {
  const { module } = phone()

  const plan = module.weekPlan([MON, TUE, WED])

  expect(plan[MON]!.map(e => [e.id, e.dish.id, e.cookId, e.cook])).toEqual([['p1', 'a', null, null], ['p2', 'b', null, null]])
  expect(plan[TUE]!.map(e => [e.id, e.dish.title, e.cookId, e.cook?.name])).toEqual([['p3', 'Titel c', 'ada', 'Ada']])
  expect(plan[WED]).toEqual([])
  expect(Object.keys(plan)).toEqual([MON, TUE, WED])
})

test('a Dish can be planned on several days, and twice on one', () => {
  const { module } = phone((board) => {
    board.plannedDishes.push(planned('p4', 'a', WED), planned('p5', 'a', WED))
  })

  const plan = module.weekPlan([MON, WED])

  expect(plan[MON]!.map(e => e.dish.id)).toEqual(['a', 'b'])
  expect(plan[WED]!.map(e => [e.id, e.dish.id])).toEqual([['p4', 'a'], ['p5', 'a']])
})

test('Planned Dishes of a Dish that is not on the Board are left out, and come back with it', () => {
  const { board, module } = phone()
  const gone = board.value!.columns[0]!.dishes.splice(0, 1)[0]!

  expect(module.weekPlan([MON])[MON]!.map(e => e.id)).toEqual(['p2'])

  board.value!.columns[0]!.dishes.unshift(gone)
  expect(module.weekPlan([MON])[MON]!.map(e => e.id)).toEqual(['p1', 'p2'])
})

test('a Board kept before the Week Plan reads with an empty Plan', async () => {
  const store = memoryStore()
  const kept = createKeptBoards({ store, userId: 'me' })
  const old: Partial<BoardView> = boardFixture()
  delete old.plannedDishes
  await store.boards.save('me', old as BoardView)

  const view = (await kept.board('board'))!
  const module = createBoardModule(ref<BoardView | undefined>(view), memoryTransport(boardFixture()).transport)

  expect(view.plannedDishes).toEqual([])
  expect(module.weekPlan([MON])[MON]).toEqual([])
})

test('what the Week Plan offers to plan is every Dish on the Board, the Gekocht Column\'s included', () => {
  const { board, module } = phone()

  expect(module.plannableDishes.value.map(d => d.id)).toEqual(['a', 'b', 'c', 'd'])

  board.value!.columns[0]!.dishes.splice(0, 1)
  expect(module.plannableDishes.value.map(d => d.id)).toEqual(['b', 'c', 'd'])
})

// ---- Cooked ----

const cooking = (id: string, cookedAt: string) => ({ id, cookedAt, recordedBy: null })

test('cooking from the card ticks the Planned Dish of today, and its undo unticks it', async () => {
  const { module } = phone((board) => {
    board.plannedDishes.push(planned('today', 'b', THU))
  })
  const tick = () => module.weekPlan([THU])[THU]!.find(e => e.id === 'today')!.cooked
  expect(tick()).toBe(false)

  const cooked = module.cookDish('b')!
  expect(tick()).toBe(true)
  await cooked.settled
  expect(tick()).toBe(true)

  const undone = await cooked.undo!()
  expect(tick()).toBe(false)
  await undone.settled
  expect(tick()).toBe(false)
})

test('a batch cook ticks, and so does a Cooking from the plan\'s own Gekocht', async () => {
  const { module } = phone((board) => {
    board.plannedDishes.push(planned('t1', 'a', THU), planned('t2', 'b', THU))
  })

  await module.cookDishes(['a', 'b'])!.settled

  expect(module.weekPlan([THU])[THU]!.map(e => e.cooked)).toEqual([true, true])
})

test('deleting the Cooking from the Dish\'s history unticks it', async () => {
  const { module } = phone((board) => {
    board.plannedDishes.push(planned('t1', 'd', THU))
    board.columns[2]!.dishes[0]!.cookings = [cooking('k1', '2026-11-12T09:00:00.000Z')]
  })
  expect(module.weekPlan([THU])[THU]![0]!.cooked).toBe(true)

  await module.deleteCooking('d', 'k1')!.settled

  expect(module.weekPlan([THU])[THU]![0]!.cooked).toBe(false)
})

test('a Cooking on another day does not tick the Planned Dish', async () => {
  const { module } = phone((board) => {
    board.plannedDishes.push(planned('wed', 'b', WED), planned('thu', 'b', THU))
    board.columns[0]!.dishes[1]!.cookings = [cooking('k1', '2026-11-11T18:00:00.000Z')]
  })

  const plan = module.weekPlan([WED, THU])

  expect(plan[WED]![0]!.cooked).toBe(true)
  expect(plan[THU]![0]!.cooked).toBe(false)
})

test('a Cooking counts for its day in Berlin: 23:30 UTC is already the next day', () => {
  const { module } = phone((board) => {
    board.plannedDishes.push(planned('tue', 'b', TUE), planned('wed', 'b', WED))
    // 23:30 UTC on Tuesday is 00:30 on Wednesday in Berlin (winter time).
    board.columns[0]!.dishes[1]!.cookings = [cooking('k1', '2026-11-10T23:30:00.000Z')]
  })

  const plan = module.weekPlan([TUE, WED])

  expect(plan[TUE]!.find(e => e.id === 'tue')!.cooked).toBe(false)
  expect(plan[WED]!.find(e => e.id === 'wed')!.cooked).toBe(true)
})

// ---- The four writes, online ----

test('planning a Dish shows at once at the day\'s end, is sent with the id the device made, and the Dish stays in its Column', async () => {
  const { fake, module, dayOf, board, onServer } = phone()

  const result = module.planDish('d', MON)!

  expect(dayOf(MON)).toEqual(['p1', 'p2', result.plannedDish.id])
  expect(module.weekPlan([MON])[MON]!.at(-1)!.dish.id).toBe('d')
  expect(await result.settled).not.toHaveProperty('notice')
  expect(fake.sent).toEqual([`planDish d ${MON}`])
  expect(onServer(MON)).toEqual(['p1', 'p2', result.plannedDish.id])
  expect(board.value!.columns[2]!.dishes.map(d => d.id)).toEqual(['d'])
})

test('planning at an index shifts the others', async () => {
  const { module, dayOf, fake, onServer } = phone()

  const result = module.planDish('c', MON, 1)!

  expect(dayOf(MON)).toEqual(['p1', result.plannedDish.id, 'p2'])
  await result.settled
  expect(onServer(MON)).toEqual(['p1', result.plannedDish.id, 'p2'])
  expect(fake.sent).toEqual([`planDish c ${MON} 1`])
})

test('planning on an empty day between others keeps the days in order', () => {
  const { module, board } = phone()

  module.planDish('c', WED)

  expect(board.value!.plannedDishes.map(p => p.day)).toEqual([MON, MON, TUE, WED])
})

test('a plan the server refuses is taken back, with a notice', async () => {
  const { fake, module, dayOf } = phone()
  fake.failNext('planDish', 404)

  const result = module.planDish('d', MON)!
  expect(dayOf(MON)).toHaveLength(3)

  expect(await result.settled).toMatchObject({ notice: 'planFailed' })
  expect(dayOf(MON)).toEqual(['p1', 'p2'])
})

test('a plan refused for the Member\'s Permissions says so', async () => {
  const { fake, module } = phone()
  fake.failNext('planDish', 403)

  expect(await module.planDish('d', MON)!.settled).toMatchObject({ notice: 'notAllowed' })
})

test('moving a Planned Dish to another day shows at once and is sent', async () => {
  const { fake, module, dayOf, onServer } = phone()

  const result = module.movePlannedDish('p1', TUE, 0)!

  expect(dayOf(MON)).toEqual(['p2'])
  expect(dayOf(TUE)).toEqual(['p1', 'p3'])
  expect(await result.settled).not.toHaveProperty('notice')
  expect(fake.sent).toEqual([`movePlannedDish p1 ${TUE} 0`])
  expect(onServer(TUE)).toEqual(['p1', 'p3'])
})

test('reordering within a day places it at the index, the others shift', async () => {
  const { module, dayOf, onServer } = phone()

  const result = module.movePlannedDish('p1', MON, 1)!

  expect(dayOf(MON)).toEqual(['p2', 'p1'])
  await result.settled
  expect(onServer(MON)).toEqual(['p2', 'p1'])
})

test('a move that would change nothing is not made', () => {
  const { module, fake } = phone()

  expect(module.movePlannedDish('p1', MON, 0)).toBeNull()
  expect(module.movePlannedDish('p2', MON)).toBeNull()
  expect(fake.sent).toEqual([])
})

test('a move the server refuses puts the Planned Dish back where it was, with a notice', async () => {
  const { fake, module, dayOf } = phone()
  fake.failNext('movePlannedDish', 500)

  const result = module.movePlannedDish('p1', TUE, 0)!
  expect(dayOf(MON)).toEqual(['p2'])

  expect(await result.settled).toMatchObject({ notice: 'planFailed' })
  expect(dayOf(MON)).toEqual(['p1', 'p2'])
  expect(dayOf(TUE)).toEqual(['p3'])
})

test('a move of a Planned Dish the server no longer has just removes it', async () => {
  const { fake, module, dayOf } = phone()
  fake.failNext('movePlannedDish', 404)

  const ended = await module.movePlannedDish('p1', TUE)!.settled

  expect(ended).not.toHaveProperty('notice')
  expect(dayOf(MON)).toEqual(['p2'])
  expect(dayOf(TUE)).toEqual(['p3'])
})

test('taking a Planned Dish off the plan shows at once, is sent, and leaves its Dish on the Board', async () => {
  const { fake, module, dayOf, board, onServer } = phone()

  const result = module.unplanDish('p1')!

  expect(dayOf(MON)).toEqual(['p2'])
  expect(await result.settled).not.toHaveProperty('notice')
  expect(fake.sent).toEqual(['unplanDish p1'])
  expect(onServer(MON)).toEqual(['p2'])
  expect(board.value!.columns[0]!.dishes.map(d => d.id)).toEqual(['a', 'b'])
})

test('an unplan the server refuses puts the Planned Dish back in its place, with a notice', async () => {
  const { fake, module, dayOf } = phone()
  fake.failNext('unplanDish', 500)

  const result = module.unplanDish('p1')!
  expect(dayOf(MON)).toEqual(['p2'])

  expect(await result.settled).toMatchObject({ notice: 'planFailed' })
  expect(dayOf(MON)).toEqual(['p1', 'p2'])
})

test('an unplan of a Planned Dish the server no longer has counts as done', async () => {
  const { fake, module, dayOf } = phone()
  fake.failNext('unplanDish', 404)

  expect(await module.unplanDish('p1')!.settled).not.toHaveProperty('notice')
  expect(dayOf(MON)).toEqual(['p2'])
})

test('setting who cooks shows at once and is sent; clearing it too', async () => {
  const { fake, module, onServer } = phone()

  const set = module.setPlannedDishCook('p1', 'linus')!
  expect(module.weekPlan([MON])[MON]![0]).toMatchObject({ cookId: 'linus', cook: { name: 'Linus' } })
  expect(await set.settled).not.toHaveProperty('notice')
  expect(fake.server.plannedDishes.find(p => p.id === 'p1')!.cookId).toBe('linus')

  await module.setPlannedDishCook('p1', null)!.settled
  expect(module.weekPlan([MON])[MON]![0]).toMatchObject({ cookId: null, cook: null })
  expect(fake.server.plannedDishes.find(p => p.id === 'p1')!.cookId).toBeNull()
  expect(onServer(MON)).toEqual(['p1', 'p2'])
})

test('a cook the server refuses (no Member) is taken back to who cooked before, with a notice', async () => {
  const { fake, module } = phone((board) => {
    board.members.push(member('stranger', 'Fremd'))
  })
  fake.server.members = fake.server.members.filter(m => m.id !== 'stranger')

  const result = module.setPlannedDishCook('p3', 'stranger')!
  expect(module.weekPlan([TUE])[TUE]![0]!.cookId).toBe('stranger')

  expect(await result.settled).toMatchObject({ notice: 'planCookFailed' })
  expect(module.weekPlan([TUE])[TUE]![0]!.cookId).toBe('ada')
})

test('the writes are not offered without the Permission to move Dishes', () => {
  const { module, dayOf, fake } = phone((board) => {
    board.isOwner = false
    board.permissions = { ...ALL_PERMISSIONS, moveDishes: false }
  })

  expect(module.planDish('d', MON)).toBeNull()
  expect(module.movePlannedDish('p1', TUE)).toBeNull()
  expect(module.unplanDish('p1')).toBeNull()
  expect(module.setPlannedDishCook('p1', 'ada')).toBeNull()
  expect(dayOf(MON)).toEqual(['p1', 'p2'])
  expect(fake.sent).toEqual([])
})

test('a Dish that is not on the Board cannot be planned', () => {
  const { module, fake } = phone()

  expect(module.planDish('nowhere', MON)).toBeNull()
  expect(fake.sent).toEqual([])
})

test('a day that is no calendar date cannot be planned or moved to', () => {
  const { module, fake } = phone()

  for (const day of ['2026-99-99', '2026-02-30', '2026-13-01', '2026-00-10', '2026-11-31', 'Montag', '2026-1-1']) {
    expect(module.planDish('d', day), day).toBeNull()
    expect(module.movePlannedDish('p1', day), day).toBeNull()
  }
  expect(fake.sent).toEqual([])
  // A leap day is one.
  expect(module.planDish('d', '2028-02-29')).not.toBeNull()
})

// ---- Together ----

test('another Member\'s change to the plan arrives with the Board sync', async () => {
  const { fake, module, dayOf } = phone()
  fake.server.plannedDishes.push(planned('p9', 'd', MON))
  fake.server.plannedDishes = fake.server.plannedDishes.filter(p => p.id !== 'p2')

  expect(await module.sync(() => Promise.resolve(structuredClone(fake.server)))).toBe(true)

  expect(dayOf(MON)).toEqual(['p1', 'p9'])
})

test('a Dish another Member archived leaves the plan with the next sync, and a restore brings its Planned Dishes back', async () => {
  const { fake, module, dayOf } = phone()
  const ask = () => Promise.resolve(structuredClone(fake.server))

  fake.deleteDishElsewhere('a')
  await module.sync(ask)
  expect(dayOf(MON)).toEqual(['p2'])

  await fake.transport.restoreDish('a')
  await module.sync(ask)
  expect(dayOf(MON)).toEqual(['p1', 'p2'])
})

// ---- Offline ----

test('a plan made without a connection shows at once, is kept, and is sent with the time it was made', async () => {
  const { fake, module, dayOf, unsent, onServer } = phone()
  fake.setAnswers('none')

  const result = module.planDish('d', MON, 0)!
  const id = result.plannedDish.id
  const ended = await result.settled
  const tapped = new Date().toISOString()

  expect(ended).toMatchObject({ unsent: true })
  expect(ended).not.toHaveProperty('notice')
  expect(dayOf(MON)).toEqual([id, 'p1', 'p2'])
  expect(module.weekPlan([MON])[MON]![0]!.unsent).toBe(true)
  expect(unsent.changes.value.map(c => c.kind)).toEqual(['plan'])
  expect(onServer(MON)).toEqual(['p1', 'p2'])

  await answerAgain(fake)
  expect(asRun(await unsent.send())).toMatchObject({ sent: 1, emptied: true })

  expect(onServer(MON)).toEqual([id, 'p1', 'p2'])
  expect(fake.plannedMadeAt).toEqual([tapped])
  expect(module.weekPlan([MON])[MON]![0]!.unsent).toBe(false)
})

test('a move, an unplan and a cook made without a connection are Unsent Changes that go out in order', async () => {
  const { fake, module, dayOf, unsent, onServer } = phone()
  fake.setAnswers('none')

  await module.movePlannedDish('p1', TUE, 0)!.settled
  await module.setPlannedDishCook('p2', 'linus')!.settled
  await module.unplanDish('p3')!.settled

  expect(unsent.changes.value.map(c => c.kind)).toEqual(['planMove', 'planCook', 'unplan'])
  expect(dayOf(MON)).toEqual(['p2'])
  expect(dayOf(TUE)).toEqual(['p1'])
  expect(module.weekPlan([MON])[MON]![0]!.cook?.name).toBe('Linus')

  await answerAgain(fake)
  fake.sent.length = 0
  expect(asRun(await unsent.send())).toMatchObject({ sent: 3, emptied: true })

  expect(onServer(MON)).toEqual(['p2'])
  expect(onServer(TUE)).toEqual(['p1'])
  expect(fake.server.plannedDishes.find(p => p.id === 'p2')!.cookId).toBe('linus')
  expect(fake.sent).toEqual([`movePlannedDish p1 ${TUE} 0`, 'setPlannedDishCook p2 linus', 'unplanDish p3'])
  expect(fake.plannedMadeAt).toHaveLength(3)
  expect(fake.plannedMadeAt.every(at => at === new Date().toISOString())).toBe(true)
})

test('while changes wait, a new plan change joins them without trying the network', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('none')
  await module.planDish('d', MON)!.settled
  fake.setAnswers('answering')
  fake.sent.length = 0

  const ended = await module.unplanDish('p1')!.settled

  expect(ended).toMatchObject({ unsent: true })
  expect(fake.sent.filter(s => s.startsWith('unplan'))).toEqual([])
  expect(unsent.count.value).toBe(2)
})

test('Unsent Changes of the plan survive a closed app and show again on the reopened Board', async () => {
  const first = phone()
  first.fake.setAnswers('none')
  const id = first.module.planDish('d', WED)!.plannedDish.id
  await first.module.movePlannedDish('p1', TUE, 0)!.settled
  await first.unsent.saved()

  // The app opened again: the Board as the server has it, the same device store.
  await answerAgain(first.fake)
  const second = phoneOn(first.fake, first.store)
  await second.module.layOverUnsent()

  expect(second.unsent.count.value).toBe(2)
  expect(second.dayOf(WED)).toEqual([id])
  expect(second.dayOf(TUE)).toEqual(['p1', 'p3'])

  expect(asRun(await second.unsent.send())).toMatchObject({ sent: 2, emptied: true })
  expect(second.onServer(WED)).toEqual([id])
  expect(second.onServer(TUE)).toEqual(['p1', 'p3'])
})

test('a plan whose answer was lost, sent again, is on the plan once', async () => {
  const { fake, module, unsent, onServer } = phone()
  fake.setAnswers('lost')

  const planning = module.planDish('d', MON)!
  const id = planning.plannedDish.id
  expect(await planning.settled).toMatchObject({ unsent: true })
  expect(onServer(MON)).toEqual(['p1', 'p2', id])

  await answerAgain(fake)
  await unsent.send()

  expect(onServer(MON)).toEqual(['p1', 'p2', id])
  expect(onServer(MON)).toContain(id)
  expect(unsent.count.value).toBe(0)
})

test('a Board sync while plan changes are unsent keeps them on top of what the server says', async () => {
  const { fake, module, dayOf, unsent } = phone()
  fake.setAnswers('none')
  const id = module.planDish('d', MON, 0)!.plannedDish.id
  await module.setPlannedDishCook('p1', 'linus')!.settled
  fake.server.plannedDishes.push(planned('p9', 'c', MON))
  await new Promise(resolve => setTimeout(resolve))

  expect(await module.sync(() => Promise.resolve(structuredClone(fake.server)))).toBe(true)

  expect(dayOf(MON)).toEqual([id, 'p1', 'p2', 'p9'])
  expect(module.weekPlan([MON])[MON]!.find(e => e.id === 'p1')!.cookId).toBe('linus')
  expect(unsent.count.value).toBe(2)
})

// Each change dropped when the server answers that it can't apply it, whatever
// the status: the Member is told (the run names it), and the Plan is put right.
test.for([404, 400, 403])('an offline plan change the server answers %i is dropped, named, and the plan corrected', async (status) => {
  const { fake, module, dayOf, unsent } = phone()
  fake.setAnswers('none')
  const plan = module.planDish('d', WED)!
  await plan.settled
  await module.movePlannedDish('p1', TUE, 0)!.settled
  await module.setPlannedDishCook('p2', 'linus')!.settled
  await module.unplanDish('p3')!.settled
  expect(unsent.count.value).toBe(4)

  await answerAgain(fake)
  for (const write of ['planDish', 'movePlannedDish', 'setPlannedDishCook', 'unplanDish'] as const) fake.failNext(write, status)
  const run = asRun(await unsent.send())

  // The first, the plan, took its dependants with it: only it is named.
  expect(unsent.count.value).toBe(0)
  expect(run.dropped.map(c => c.kind)).toEqual(['plan', 'planMove', 'planCook', 'unplan'])
  expect(unsent.takeDropped().map(c => c.label)).toEqual(['Titel d', 'Titel a', 'Titel b', 'Titel c'])
  void module.droppedChanges(run.dropped)
  expect(dayOf(WED)).toEqual([])

  // The Board load that follows puts the rest right.
  await module.sync(() => Promise.resolve(structuredClone(fake.server)))
  expect(dayOf(MON)).toEqual(['p1', 'p2'])
  expect(dayOf(TUE)).toEqual(['p3'])
  expect(module.weekPlan([MON])[MON]![1]!.cook).toBeNull()
})

test('a plan dropped on arrival takes what was done to that Planned Dish since with it, unnamed', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('none')
  const id = module.planDish('d', WED)!.plannedDish.id
  await module.setPlannedDishCook(id, 'ada')!.settled
  await module.movePlannedDish(id, THU)!.settled
  expect(unsent.count.value).toBe(3)

  await answerAgain(fake)
  fake.failNext('planDish', 404)
  const run = asRun(await unsent.send())

  expect(run.dropped.map(c => c.kind)).toEqual(['plan'])
  expect(unsent.count.value).toBe(0)
})
