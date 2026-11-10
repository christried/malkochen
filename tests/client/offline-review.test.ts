import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule } from '../../app/board/board-module'
import { createKeptBoards } from '../../app/board/kept-boards'
import { createUnsentChanges, layOver, type UnsentChange } from '../../app/board/unsent-changes'
import type { BoardView } from '../../server/utils/boards'
import type { Me } from '../../server/utils/people'
import type { DishView } from '../../server/utils/dishes'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { memoryStore } from './memory-device-store'
import { memoryTransport } from './memory-transport'

// The review of spec #456: laying over twice, a stale tab, and what a Board
// that went leaves on the device.

const at = '2026-10-01T12:00:00.000Z'
const anna = { id: 'anna', name: 'Anna', image: null } as unknown as Me
const ben = { id: 'ben', name: 'Ben', image: null } as unknown as Me
const adder = { id: 'anna', name: 'Anna', image: null }

function dish(id: string, extra: Partial<DishView> = {}): DishView {
  return { id, code: `c${id}`, title: `Titel ${id}`, source: null, creator: null, caption: null, playableVideo: null, imageUrl: null, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: at, cookings: [], votes: [], commentCount: 0, ...extra }
}

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
      { id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a', { commentCount: 3 }), dish('b'), dish('c')] },
      { id: 'gekocht', name: 'Gekocht', subtitle: null, isGekocht: true, dishes: [dish('d', { cookings: [{ id: 'k1', cookedAt: at, recordedBy: null }] }), dish('e', { cookings: [{ id: 'k2', cookedAt: at, recordedBy: null }] })] },
    ],
  }
}

const base = { boardId: 'board', madeAt: at, label: 'x' }
const everyKind: UnsentChange[] = [
  { ...base, id: '1', kind: 'move', dishId: 'a', columnId: 'ideen', index: 2 },
  { ...base, id: '2', kind: 'move', dishId: 'a', columnId: 'gekocht', index: 0, cookingId: 'k9' },
  { ...base, id: '3', kind: 'cook', dishId: 'b', cookingId: 'k3' },
  { ...base, id: '4', kind: 'cookMany', dishIds: ['b', 'c'], cookingIds: ['k4', 'k5'] },
  { ...base, id: '5', kind: 'uncook', dishId: 'd', cookingId: 'k1', back: { columnId: 'ideen', index: 1 } },
  { ...base, id: '6', kind: 'uncookMany', dishIds: ['d', 'e'], cookings: [{ cookingId: 'k1', back: { columnId: 'ideen', index: 0 } }, { cookingId: 'k2', back: { columnId: 'ideen', index: 3 } }] },
  { ...base, id: '7', kind: 'comment', dishId: 'a', commentId: 'cm1', text: 'Lecker', author: adder },
  { ...base, id: '8', kind: 'commentEdit', dishId: 'a', commentId: 'cm1', text: 'Sehr lecker' },
  { ...base, id: '9', kind: 'commentDelete', dishId: 'a', commentId: 'cm0' },
  { ...base, id: '10', kind: 'vote', dishId: 'a', up: true, voter: adder },
  { ...base, id: '11', kind: 'title', dishId: 'a', title: 'Neu' },
  { ...base, id: '12', kind: 'add', dishId: 'zzzzzzzzzzzzzzzz', link: 'https://example.com/x', title: null, placeholder: 'bowl', adder },
] as UnsentChange[]

test.each(everyKind.map(c => [c.kind, c] as const))('laying a %s over a Board a second time changes nothing more', (_kind, change) => {
  const once = layOver(boardFixture(), [change])
  const same = boardFixture()
  layOver(same, [change])
  layOver(same, [change])
  expect(same).toEqual(once)
})

test('the Comment count follows a Comment written once however often the Unsent Changes are laid over', () => {
  const view = boardFixture()
  const written = everyKind.find(c => c.kind === 'comment')!
  const deleted = everyKind.find(c => c.kind === 'commentDelete')!
  layOver(view, [written, deleted])
  layOver(view, [written, deleted])
  expect(view.columns[0]!.dishes[0]!.commentCount).toBe(3)
  layOver(view, [{ ...written, id: 'other', commentId: 'cm2' }])
  expect(view.columns[0]!.dishes[0]!.commentCount).toBe(4)
})

// A second tab, still holding the earlier user's list in memory.
test('Unsent Changes of a user who signed out in another tab are neither sent nor written back', async () => {
  const store = memoryStore()
  await store.user.save(anna)
  const fake = memoryTransport(boardFixture())
  const stale = createUnsentChanges({ store, transport: fake.transport, userId: 'anna' })
  await stale.ready
  stale.add({ ...base, id: 'c1', kind: 'cook', dishId: 'b', cookingId: 'k3' })
  await stale.saved()
  expect(await store.unsent.load('anna')).toHaveLength(1)

  // Another tab: signs out and signs in as ben.
  await store.clear()
  await store.user.save(ben)

  expect(await stale.send()).not.toMatchObject({ sent: 1 })
  expect(fake.server.columns[1]!.dishes.map(d => d.id)).not.toContain('b')
  stale.add({ ...base, id: 'c2', kind: 'cook', dishId: 'c', cookingId: 'k4' })
  await stale.saved()
  expect(await store.unsent.load('anna')).toEqual([])
})

test('after a sign-out in another tab nothing is written back either', async () => {
  const store = memoryStore()
  await store.user.save(anna)
  const fake = memoryTransport(boardFixture())
  const stale = createUnsentChanges({ store, transport: fake.transport, userId: 'anna' })
  await stale.ready
  await store.clear()
  stale.add({ ...base, id: 'c1', kind: 'cook', dishId: 'b', cookingId: 'k3' })
  await stale.saved()
  expect(await store.unsent.load('anna')).toEqual([])
  expect(await stale.send()).not.toMatchObject({ sent: 1 })
})

test('a Board kept after the user signed out in another tab is not written back', async () => {
  const store = memoryStore()
  await store.user.save(anna)
  const kept = createKeptBoards({ store, userId: 'anna' })
  await kept.board('board')
  await store.clear()
  await kept.keep(boardFixture())
  await kept.opened(boardFixture())
  await kept.keepHistory('board', 'a', { entries: [] } as never)
  expect(await store.boards.load('anna', 'board')).toBeNull()
  expect(await store.last.load('anna')).toBeNull()
  expect(await store.histories.load('anna', 'a')).toBeNull()
})

test('a Board kept after another user signed in is not written back', async () => {
  const store = memoryStore()
  await store.user.save(anna)
  const kept = createKeptBoards({ store, userId: 'anna' })
  await kept.board('board')
  await store.clear()
  await store.user.save(ben)
  await kept.keep(boardFixture())
  expect(await store.boards.load('anna', 'board')).toBeNull()
})

// The Board screen lays them over the kept Board (device.openKept) and again
// once it is mounted (layOverUnsent): the same object, in a ref.
test('a Board opened from the device shows the Comment count once', async () => {
  const store = memoryStore()
  await store.user.save(anna)
  const fake = memoryTransport(boardFixture())
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'anna' })
  await unsent.ready
  unsent.add({ ...base, id: 'c1', kind: 'comment', dishId: 'a', commentId: 'cm1', text: 'Lecker', author: adder })
  const shown = layOver(boardFixture(), unsent.forBoard('board'))
  const board = ref<BoardView | undefined>(shown)
  const module = createBoardModule(board, fake.transport, { unsent })
  await module.layOverUnsent()
  expect(board.value!.columns[0]!.dishes[0]!.commentCount).toBe(4)
})

test('opening a Dish that malkochen does not answer leaves what is new in its History marked', async () => {
  const fake = memoryTransport(boardFixture())
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const module = createBoardModule(board, fake.transport, {})
  board.value!.newInHistoryDishIds = ['a', 'b']
  fake.setAnswers('none')

  expect(await module.openDish('a')).toBe(false)
  expect([...board.value!.newInHistoryDishIds].sort()).toEqual(['a', 'b'])

  fake.setAnswers('answering')
  expect(await module.openDish('a')).toBe(true)
  expect(board.value!.newInHistoryDishIds).toEqual(['b'])
})

function withImages(id: string, ...urls: string[]): BoardView {
  const view = boardFixture()
  view.id = id
  view.slug = id
  view.columns[0]!.dishes = urls.map((url, i) => dish(`${id}${i}`, { imageUrl: url }))
  view.columns[1]!.dishes = [dish(`${id}x`)]
  return view
}

test('a Board that is removed from the device takes its Dishes\' images with it, but not those another kept Board shows', async () => {
  const gone: string[] = []
  const store = memoryStore()
  const kept = createKeptBoards({ store, userId: 'me', forgetImages: async (urls) => { gone.push(...urls) } })
  await kept.keep(withImages('one', 'https://blob/a.jpg', 'https://blob/shared.jpg'))
  await kept.keep(withImages('two', 'https://blob/b.jpg', 'https://blob/shared.jpg'))
  await kept.keep(withImages('three', 'https://blob/c.jpg'))

  await kept.remove('one')
  expect(gone.sort()).toEqual(['https://blob/a.jpg'])
  expect(await kept.board('one')).toBeNull()

  // Left, archived or deleted elsewhere: the Board Switcher's list no longer has it.
  gone.length = 0
  await kept.keepListings([{ id: 'two', slug: 'two', name: 'two', emoji: 'x', isOwner: true, permissions: ALL_PERMISSIONS, dishCount: 1, members: [], columns: [] } as never])
  expect(gone.sort()).toEqual(['https://blob/c.jpg'])
})

test('a save that got no answer keeps the Member\'s choice of the Placeholder Image over the Source\'s image', async () => {
  const fake = memoryTransport(boardFixture())
  const sentLate: unknown[] = []
  const transport = { ...fake.transport, addDishLate: (boardId: string, body: Parameters<typeof fake.transport.addDishLate>[1]) => { sentLate.push(body); return fake.transport.addDishLate(boardId, body) } }
  const store = memoryStore()
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const unsent = createUnsentChanges({ store, transport, userId: 'anna' })
  const module = createBoardModule(board, transport, { unsent })
  fake.setAnswers('none')

  // Looked up online, then the Member picked a Placeholder Image: no image sent.
  await module.addDish('board', { title: 'Pasta', placeholder: 'bowl', source: { link: 'https://example.com/a' }, sourceTicket: 'ticket', imageUrl: null }, adder)
  // Never looked up (offline from the start): nothing was chosen.
  await module.addDish('board', { title: '', placeholder: 'bowl', source: { link: 'https://example.com/b' } }, adder)
  expect(unsent.changes.value).toMatchObject([{ kind: 'add', link: 'https://example.com/a', noImage: true }, { kind: 'add', link: 'https://example.com/b' }])
  expect(unsent.changes.value[1]).not.toHaveProperty('noImage')

  fake.setAnswers('answering')
  await unsent.send()
  expect(sentLate).toMatchObject([{ source: { link: 'https://example.com/a' }, noImage: true }, { source: { link: 'https://example.com/b' } }])
  expect(sentLate[1]).not.toHaveProperty('noImage')
})
