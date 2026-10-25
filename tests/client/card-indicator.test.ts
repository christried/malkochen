import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule } from '../../app/board/board-module'
import type { BoardView } from '../../server/utils/boards'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import type { DishView } from '../../server/utils/dishes'
import { memoryTransport, type MemoryTransport } from './memory-transport'

// Seam 4: what a Dish's card shows of its Dish History (#335) through the
// client Board module, against the in-memory transport: opening a Dish
// clears its mark for what's new, and its Comment count follows the
// Member's own Comment writes at once, like the writes themselves.

const ME = { id: 'me', name: 'Ich', image: null }

function dish(id: string): DishView {
  return {
    id,
    code: `c${id}`,
    title: `Titel ${id}`,
    source: null,
    creator: null,
    caption: null,
    playableVideo: null,
    imageUrl: null,
    imageFocus: { x: 50, y: 50 },
    placeholder: 'bowl',
    addedBy: { id: 'ada', name: 'Ada', image: null },
    createdAt: '2026-10-01T12:00:00.000Z',
    cookings: [],
    votes: [],
    commentCount: 0,
  }
}

// A Board with Ideen (a, b), where Ada commented on a since the Member
// last opened it.
function setup() {
  const fixture: BoardView = {
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
    newInHistoryDishIds: ['a'],
    columns: [
      { id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a'), dish('b')] },
      { id: 'gekocht', name: 'Gekocht', subtitle: 'Schon geschafft!', isGekocht: true, dishes: [] },
    ],
  }
  const board = ref<BoardView | undefined>(structuredClone(fixture))
  const fake = memoryTransport(fixture)
  const module = createBoardModule(board, fake.transport)
  const count = (dishId: string) => board.value!.columns.flatMap(c => c.dishes).find(d => d.id === dishId)!.commentCount
  return { board, fake, module, count }
}

// The server answers the Board as it read it when asked, only once the
// test says so.
function askServerSlowly(fake: MemoryTransport) {
  let answer = () => {}
  const ask = () => {
    const read = structuredClone(fake.server)
    return new Promise<BoardView>(resolve => (answer = () => resolve(read)))
  }
  return { ask, answer: () => answer() }
}

test('opening a Dish clears its mark at once, and the server records it', async () => {
  const { board, fake, module } = setup()
  const held = fake.holdNext('openDish')

  const opening = module.openDish('a')

  expect(board.value!.newInHistoryDishIds).toEqual([])
  held.succeed()
  expect(await opening).toBe(true)
  expect(fake.sent).toEqual(['openDish a'])
  expect(fake.server.newInHistoryDishIds).toEqual([])
})

test('a poll asked before the Dish opened doesn\'t bring its mark back', async () => {
  const { board, fake, module } = setup()
  const slow = askServerSlowly(fake)
  const polled = module.sync(slow.ask)

  await module.openDish('a')
  slow.answer()
  await polled

  expect(board.value!.newInHistoryDishIds).toEqual([])
})

test('a Comment written counts on its Dish at once; one whose write fails doesn\'t', async () => {
  const { fake, module, count } = setup()

  const written = module.writeComment('a', 'Lecker!', ME)!
  expect(count('a')).toBe(1)
  await written.settled
  expect(count('a')).toBe(1)

  fake.failNext('writeComment', 500)
  const failed = module.writeComment('a', 'Zu salzig', ME)!
  expect(count('a')).toBe(2)
  await failed.settled
  expect(count('a')).toBe(1)
})

test('a deleted Comment no longer counts, "Rückgängig" counts it again, and a failed delete keeps it counted', async () => {
  const { fake, module, count } = setup()
  const { id } = fake.writeCommentElsewhere('a', 'Zu salzig')
  await module.sync(() => Promise.resolve(structuredClone(fake.server)))
  await module.openDish('a')
  expect(count('a')).toBe(1)

  const deleted = module.deleteComment('a', id)!
  expect(count('a')).toBe(0)
  await deleted.settled
  const restored = await deleted.undo!()
  expect(count('a')).toBe(1)
  await restored.settled
  expect(count('a')).toBe(1)

  fake.failNext('deleteComment', 500)
  const failed = module.deleteComment('a', id)!
  expect(count('a')).toBe(0)
  await failed.settled
  expect(count('a')).toBe(1)
})
