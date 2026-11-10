import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule, type BoardResult } from '../../app/board/board-module'
import { createUnsentChanges, type SendRun } from '../../app/board/unsent-changes'
import { MILESTONE_COOKINGS } from '../../app/utils/achievement'
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { memoryStore } from './memory-device-store'
import { memoryTransport } from './memory-transport'

// Seam 4: Unsent Changes (spec #456, ticket #459) through the Board module,
// against the in-memory transport with its modes of not answering and the
// in-memory device store.

function dish(id: string): DishView {
  return { id, code: `c${id}`, title: `Titel ${id}`, source: null, creator: null, caption: null, playableVideo: null, imageUrl: null, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [], votes: [], commentCount: 0 }
}

// A Board with Ideen (a, b, c), Diese Woche (d) and Gekocht (empty).
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
    asOperator: false,
    columns: [
      { id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a'), dish('b'), dish('c')] },
      { id: 'woche', name: 'Diese Woche', subtitle: null, isGekocht: false, dishes: [dish('d')] },
      { id: 'gekocht', name: 'Gekocht', subtitle: null, isGekocht: true, dishes: [] },
    ],
  }
}

// The phone: a Board on screen, its Board module and its Unsent Changes over
// `store`, against `fake`'s server. A second call with the same store and
// server is the app opened again.
function phone(fake = memoryTransport(boardFixture()), store = memoryStore(), shape: (board: BoardView) => void = () => {}) {
  const view = structuredClone(fake.server)
  shape(view)
  const board = ref<BoardView | undefined>(view)
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'me' })
  const module = createBoardModule(board, fake.transport, { unsent })
  const shown = () => Object.fromEntries(board.value!.columns.map(c => [c.id, c.dishes.map(d => d.id)]))
  const onServer = () => Object.fromEntries(fake.server.columns.map(c => [c.id, c.dishes.map(d => d.id)]))
  const cookings = (dishId: string) => board.value!.columns.flatMap(c => c.dishes).find(d => d.id === dishId)!.cookings
  return { fake, store, board, unsent, module, shown, onServer, cookings }
}

// malkochen answers again. First a beat, so the sends the module tried
// meanwhile (each change tries to send them all) have ended unanswered.
async function answerAgain(fake: { setAnswers: (mode: 'answering') => void }) {
  await new Promise(resolve => setTimeout(resolve, 0))
  fake.setAnswers('answering')
}

const asRun =(outcome: Awaited<ReturnType<ReturnType<typeof createUnsentChanges>['send']>>) => outcome as SendRun

test('a move that gets no answer stays on screen and is counted as unsent', async () => {
  const { fake, module, shown, unsent } = phone()
  fake.setAnswers('none')

  const moved = module.moveDish('b', { columnId: 'woche' })!
  const ended = await moved.settled

  expect(ended).toMatchObject({ unsent: true })
  expect(ended).not.toHaveProperty('notice')
  expect(shown()).toMatchObject({ ideen: ['a', 'c'], woche: ['b', 'd'] })
  expect(unsent.count.value).toBe(1)
  expect(fake.server.columns[1]!.dishes.map(d => d.id)).toEqual(['d'])
})

test('a refused move rolls back as ever and is not kept', async () => {
  const { fake, module, shown, unsent } = phone()

  fake.failNext('moveDish', 403)
  expect(await module.moveDish('b', { columnId: 'woche' })!.settled).toMatchObject({ notice: 'notAllowed' })
  fake.failNext('moveDish', 404)
  expect(await module.moveDish('a', { columnId: 'woche' })!.settled).not.toHaveProperty('unsent')

  expect(unsent.count.value).toBe(0)
  expect(shown().ideen).toContain('b')
})

test('a write answered 401 rolls back as ever, but a replay answered 401 keeps the change and stops', async () => {
  const { fake, module, shown, unsent } = phone()
  fake.failNext('cookDish', 401)
  expect(await module.cookDish('a')!.settled).toMatchObject({ notice: 'cookFailed' })
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(unsent.count.value).toBe(0)

  fake.setAnswers('none')
  await module.cookDish('a')!.settled
  await module.moveDish('b', { columnId: 'woche' })!.settled
  await answerAgain(fake)
  fake.failNext('cookDish', 401)

  expect(await unsent.send()).toBe('signedOut')
  expect(unsent.count.value).toBe(2)
  expect(unsent.takeDropped()).toEqual([])

  expect(asRun(await unsent.send())).toMatchObject({ sent: 2, emptied: true })
  expect(fake.server.columns[2]!.dishes.map(d => d.id)).toEqual(['a'])
})

test('several changes are sent in order once malkochen answers', async () => {
  const { fake, module, unsent, onServer } = phone()
  fake.setAnswers('none')
  await module.moveDish('a', { columnId: 'woche' })!.settled
  await module.cookDish('b')!.settled
  await module.moveDish('c', { columnId: 'woche', index: 1 })!.settled
  expect(unsent.count.value).toBe(3)
  fake.sent.length = 0

  await answerAgain(fake)
  const run = asRun(await unsent.send())

  expect(run).toMatchObject({ sent: 3, dropped: [], emptied: true })
  expect(fake.sent.map(s => s.split(' ').slice(0, 2).join(' '))).toEqual(['moveDish a', 'cookDish b', 'moveDish c'])
  expect(onServer()).toEqual({ ideen: [], woche: ['a', 'c', 'd'], gekocht: ['b'] })
  expect(unsent.count.value).toBe(0)
})

test('a change that cannot be applied is dropped and named, and the rest still arrive', async () => {
  const { fake, module, unsent, onServer } = phone()
  fake.setAnswers('none')
  await module.moveDish('a', { columnId: 'woche' })!.settled
  await module.cookDish('b')!.settled
  await answerAgain(fake)
  fake.deleteDishElsewhere('a')

  const run = asRun(await unsent.send())

  expect(run).toMatchObject({ sent: 1, emptied: true })
  expect(run.dropped.map(c => [c.kind, c.label])).toEqual([['move', 'Titel a']])
  expect(unsent.takeDropped().map(c => c.label)).toEqual(['Titel a'])
  expect(unsent.takeDropped()).toEqual([])
  expect(onServer()).toEqual({ ideen: ['c'], woche: ['d'], gekocht: ['b'] })
})

test('a Board sync while changes are unsent keeps them on top of what the server says', async () => {
  const { fake, module, shown, unsent, cookings } = phone()
  fake.setAnswers('none')
  await module.moveDish('a', { columnId: 'woche', index: 0 })!.settled
  await module.cookDish('b')!.settled
  fake.writeCommentElsewhere('c', 'hm')
  fake.server.columns[0]!.dishes.push({ ...fake.server.columns[0]!.dishes[0]!, id: 'z', title: 'Titel z' })
  // A beat, so the sends the changes started have ended unanswered.
  await new Promise(resolve => setTimeout(resolve))

  expect(await module.sync(() => Promise.resolve(structuredClone(fake.server)))).toBe(true)

  expect(shown()).toEqual({ ideen: ['c', 'z'], woche: ['a', 'd'], gekocht: ['b'] })
  expect(cookings('b')).toHaveLength(1)
  expect(unsent.count.value).toBe(2)
})

test('a Gekocht ✓ whose answer was lost, sent again, records one Cooking', async () => {
  const { fake, module, unsent, cookings } = phone()
  fake.setAnswers('lost')

  const cooked = module.cookDish('b')!
  expect(await cooked.settled).toMatchObject({ unsent: true })
  expect(fake.server.columns[2]!.dishes[0]!.cookings).toHaveLength(1)

  await answerAgain(fake)
  await unsent.send()

  expect(fake.server.columns[2]!.dishes[0]!.cookings).toHaveLength(1)
  expect(fake.server.columns[2]!.dishes[0]!.cookings[0]!.id).toBe(cookings('b')[0]!.id)
  expect(unsent.count.value).toBe(0)
})

test('Unsent Changes survive a closed app and show again on the reopened Board', async () => {
  const first = phone()
  first.fake.setAnswers('none')
  await first.module.moveDish('a', { columnId: 'woche' })!.settled
  await first.module.cookDish('b')!.settled
  await first.unsent.saved()

  // The app opened again: the Board as the server has it, the same device store.
  await answerAgain(first.fake)
  const second = phone(first.fake, first.store)
  await second.module.layOverUnsent()

  expect(second.unsent.count.value).toBe(2)
  expect(second.shown()).toEqual({ ideen: ['c'], woche: ['a', 'd'], gekocht: ['b'] })
  expect(second.cookings('b')).toHaveLength(1)

  expect(asRun(await second.unsent.send())).toMatchObject({ sent: 2, emptied: true })
  await second.unsent.saved()
  expect(second.onServer()).toEqual({ ideen: ['c'], woche: ['a', 'd'], gekocht: ['b'] })
  expect((await first.store.unsent.load('me'))).toEqual([])
})

test('taking back a cook of several before it is sent sends nothing', async () => {
  const { fake, module, shown, unsent, cookings, onServer } = phone()
  fake.setAnswers('none')
  const cooked = module.cookDishes(['a', 'd'])!
  await cooked.settled
  expect(unsent.count.value).toBe(1)

  const undone = await cooked.undo!()
  await undone.settled

  expect(shown()).toEqual({ ideen: ['a', 'b', 'c'], woche: ['d'], gekocht: [] })
  expect(cookings('a')).toEqual([])
  expect(unsent.count.value).toBe(0)
  await answerAgain(fake)
  fake.sent.length = 0
  await unsent.send()
  expect(fake.sent).toEqual([])
  expect(onServer()).toEqual({ ideen: ['a', 'b', 'c'], woche: ['d'], gekocht: [] })
})

test('taking back a Cooking that was recorded while others wait becomes an Unsent Change', async () => {
  const { fake, module, shown, unsent, onServer } = phone()
  const cooked = module.cookDish('b')!
  await cooked.settled
  expect(unsent.count.value).toBe(0)

  fake.setAnswers('none')
  const undone = await cooked.undo!()
  expect(await undone.settled).toMatchObject({ unsent: true })
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(unsent.changes.value.map(c => c.kind)).toEqual(['uncook'])

  await answerAgain(fake)
  await unsent.send()
  expect(onServer()).toEqual({ ideen: ['a', 'b', 'c'], woche: ['d'], gekocht: [] })
  expect(fake.server.columns[0]!.dishes[1]!.cookings).toEqual([])
})

test('a Cooking made offline is dated with the time it was tapped', async () => {
  const { fake, module, unsent, cookings } = phone()
  fake.setAnswers('none')
  const cooked = module.cookDish('b')!
  const tapped = cooked.cooking!.cookedAt
  await cooked.settled
  await new Promise(resolve => setTimeout(resolve, 15))

  await answerAgain(fake)
  await unsent.send()

  expect(fake.server.columns[2]!.dishes[0]!.cookings[0]!.cookedAt).toBe(tapped)
  expect(cookings('b')[0]!.cookedAt).toBe(tapped)
})

test('an offline Gekocht ✓ raises the Dish’s Cooking count at once, and a batch reports its Klassiker by that count', async () => {
  const { fake, module, cookings } = phone(undefined, undefined, (board) => {
    board.columns[0]!.dishes[0]!.cookings = Array.from({ length: MILESTONE_COOKINGS - 1 }, (_, i) => ({ id: `old-${i}`, cookedAt: `2026-09-${10 + i}T12:00:00.000Z`, recordedBy: null }))
  })
  fake.setAnswers('none')

  const one = module.cookDish('b')!
  expect(cookings('b')).toHaveLength(1)
  expect(one).toMatchObject({ cooking: { id: cookings('b')[0]!.id } })

  const batch = module.cookDishes(['a', 'c'])!
  expect(cookings('a')).toHaveLength(MILESTONE_COOKINGS)
  const ended = await batch.settled
  expect(ended).toMatchObject({ unsent: true })
  expect(ended!.klassiker!.map(k => [k.dish.id, k.cooking.id])).toEqual([['a', cookings('a')[0]!.id]])
})

test('the unsent Cooking is recording until it has been sent', async () => {
  const { fake, module, unsent, cookings } = phone()
  fake.setAnswers('none')
  const result: BoardResult = module.cookDish('b')!
  await result.settled
  const id = cookings('b')[0]!.id

  expect(module.isRecording(id)).toBe(true)
  expect(unsent.hasCooking(id)).toBe(true)
  await answerAgain(fake)
  await unsent.send()
  expect(module.isRecording(id)).toBe(false)
})
