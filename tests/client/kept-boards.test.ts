import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule } from '../../app/board/board-module'
import { boardIsGone, createKeptBoards } from '../../app/board/kept-boards'
import { gotNoAnswer } from '../../app/board/write-failed'
import { createUnsentChanges, layOver } from '../../app/board/unsent-changes'
import type { BoardListing, BoardView } from '../../server/utils/boards'
import type { DishHistory } from '../../server/utils/dish-history'
import type { DishView } from '../../server/utils/dishes'
import { ALL_PERMISSIONS, VIEW_ONLY } from '../../shared/permissions'
import { memoryStore } from './memory-device-store'
import { memoryTransport } from './memory-transport'

// What the device keeps of the user's Boards (spec #456, ticket #461), over
// the in-memory device store: kept as loaded, updated on a sync, removed when
// gone, cleared on sign-out, there after a fresh start, with the Unsent
// Changes laid over it when shown.

function dish(id: string): DishView {
  return { id, code: `c${id}`, title: `Titel ${id}`, source: null, creator: null, caption: null, playableVideo: null, recipe: null, recipeSearch: null, imageUrl: null, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [], votes: [], commentCount: 0 }
}

function boardFixture(id = 'board', slug = 'kochclub', permissions = ALL_PERMISSIONS): BoardView {
  return {
    id,
    slug,
    name: slug,
    emoji: '🍜',
    isOwner: true,
    permissions,
    version: 0,
    inviteToken: 'token',
    members: [],
    newDishIds: [],
    newInHistoryDishIds: [],
    plannedDishes: [],
    shoppingItems: [],
    asOperator: false,
    columns: [
      { id: `${id}ideen`, name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish(`${id}a`), dish(`${id}b`)] },
      { id: `${id}woche`, name: 'Diese Woche', subtitle: null, isGekocht: false, dishes: [] },
      { id: `${id}gekocht`, name: 'Gekocht', subtitle: null, isGekocht: true, dishes: [] },
    ],
  }
}

const listing = (b: BoardView): BoardListing => ({ id: b.id, slug: b.slug, name: b.name, emoji: b.emoji, isOwner: b.isOwner, permissions: b.permissions, dishCount: 2, members: [], columns: [] })

// The phone: the store, and the user's kept Boards over it. A second call
// with the same store is the app started again.
function phone(store = memoryStore()) {
  return { store, kept: createKeptBoards({ store, userId: 'me' }) }
}

test('a Board opened is kept as it was loaded, and there after a fresh start', async () => {
  const { store, kept } = phone()
  const view = boardFixture()
  await kept.opened(view)
  // Later changes to the Board on screen never reach the kept copy.
  view.columns[0]!.dishes.pop()

  const again = phone(store).kept
  expect((await again.board('board'))!.columns[0]!.dishes.map(d => d.id)).toEqual(['boarda', 'boardb'])
  expect((await again.board('board'))!.permissions).toEqual(ALL_PERMISSIONS)
  expect(await again.board('other')).toBeNull()
})

test('nothing kept for one user is answered to another', async () => {
  const { store, kept } = phone()
  await kept.opened(boardFixture())

  const other = createKeptBoards({ store, userId: 'other' })
  expect(await other.board('board')).toBeNull()
  expect(await other.landing()).toBeNull()
})

test('a sync keeps the Board as the server says it, without the Unsent Changes laid over it', async () => {
  const { store, kept } = phone()
  const fake = memoryTransport(boardFixture())
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'me' })
  const module = createBoardModule(board, fake.transport, { unsent, kept })
  fake.setAnswers('none')
  await module.moveDish('boarda', { columnId: 'boardwoche' })!.settled
  expect(unsent.count.value).toBe(1)
  // Another Member's change arrives with the next load.
  fake.deleteDishElsewhere('boardb')
  fake.server.version = 1

  // A beat, so the send the move tried has ended unanswered.
  await new Promise(resolve => setTimeout(resolve))
  fake.setAnswers('answering')
  expect(await module.sync(async () => structuredClone(fake.server))).toBe(true)
  await new Promise(resolve => setTimeout(resolve))

  const stored = (await kept.board('board'))!
  expect(stored.columns.flatMap(c => c.dishes.map(d => d.id))).toEqual(['boarda'])
  // The move is not in what was kept: it is laid over it when shown.
  expect(stored.columns[0]!.dishes.map(d => d.id)).toEqual(['boarda'])
  expect(board.value!.columns[1]!.dishes.map(d => d.id)).toEqual(['boarda'])
})

test('Unsent Changes made before a restart show on the kept Board once it is opened again', async () => {
  const { store, kept } = phone()
  const fake = memoryTransport(boardFixture())
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'me' })
  const module = createBoardModule(board, fake.transport, { unsent, kept })
  await kept.opened(board.value!)
  fake.setAnswers('none')
  await module.moveDish('boarda', { columnId: 'boardwoche' })!.settled
  await unsent.saved()

  // The app starts again, with no connection: the kept Board, with the
  // Unsent Changes read back from the device laid over it.
  const restarted = phone(store).kept
  const reopened = createUnsentChanges({ store, transport: fake.transport, userId: 'me' })
  await reopened.ready
  const shown = layOver((await restarted.board('board'))!, reopened.forBoard('board'))
  expect(shown.columns.map(c => c.dishes.map(d => d.id))).toEqual([['boardb'], ['boarda'], []])
})

test('the app opens on the Board used last, else the one kept last', async () => {
  const { kept } = phone()
  expect(await kept.landing()).toBeNull()
  await kept.opened(boardFixture('one', 'eins'))
  await kept.opened(boardFixture('two', 'zwei'))
  await kept.keep(boardFixture('one', 'eins'))

  expect(await kept.landing()).toEqual({ boardId: 'two', slug: 'zwei' })
  await kept.remove('two')
  expect(await kept.landing()).toEqual({ boardId: 'one', slug: 'eins' })
})

test('something shared opens the Board used last that may be added to', async () => {
  const { kept } = phone()
  await kept.opened(boardFixture('one', 'eins'))
  await kept.opened(boardFixture('two', 'zwei', VIEW_ONLY))
  expect(await kept.landingToAdd()).toEqual({ boardId: 'one', slug: 'eins', canAdd: true })

  const readOnly = phone().kept
  await readOnly.opened(boardFixture('two', 'zwei', VIEW_ONLY))
  expect(await readOnly.landingToAdd()).toEqual({ boardId: 'two', slug: 'zwei', canAdd: false })
  expect(await phone().kept.landingToAdd()).toBeNull()
})

test('an address leads to a kept Board by its slug, its id or a Dish in it, and to nothing for a Board never opened', async () => {
  const { kept } = phone()
  await kept.opened(boardFixture())

  expect(await kept.address('kochclub', undefined)).toEqual({ boardId: 'board', slug: 'kochclub', dish: null })
  expect(await kept.address('board', undefined)).toEqual({ boardId: 'board', slug: 'kochclub', dish: null })
  expect(await kept.address('kochclub', 'titel-boarda-cboarda')).toEqual({ boardId: 'board', slug: 'kochclub', dish: 'titel-boarda-cboarda' })
  expect(await kept.address('nie-offen', undefined)).toBeNull()
})

test('an address that led somewhere online leads there offline, a former slug included', async () => {
  const { store, kept } = phone()
  await kept.opened(boardFixture())
  await kept.keepAddress('alter-name', undefined, { boardId: 'board', slug: 'kochclub', dish: null })

  expect(await phone(store).kept.address('alter-name', undefined)).toEqual({ boardId: 'board', slug: 'kochclub', dish: null })
})

test('the Board Switcher lists the Boards kept here, in the order it was fetched', async () => {
  const { store, kept } = phone()
  const one = boardFixture('one', 'eins')
  const two = boardFixture('two', 'zwei')
  const three = boardFixture('three', 'drei')
  await kept.opened(three)
  await kept.opened(one)
  await kept.keepListings([listing(one), listing(two), listing(three)])

  expect((await phone(store).kept.listings()).map(b => b.id)).toEqual(['one', 'three'])
})

test('a Board the fetched list no longer has is removed from the device, with its History and addresses', async () => {
  const { kept } = phone()
  const one = boardFixture('one', 'eins')
  const two = boardFixture('two', 'zwei')
  await kept.opened(one)
  await kept.opened(two)
  const history: DishHistory = { dishId: 'twoa', entries: [] }
  await kept.keepHistory('two', 'twoa', history)
  await kept.keepAddress('zwei', undefined, { boardId: 'two', slug: 'zwei', dish: null })

  await kept.keepListings([listing(one)])

  expect(await kept.board('two')).toBeNull()
  expect(await kept.history('twoa')).toBeNull()
  expect(await kept.address('zwei', undefined)).toBeNull()
  expect(await kept.board('one')).not.toBeNull()
  expect(await kept.landing()).toEqual({ boardId: 'one', slug: 'eins' })
})

test('malkochen saying a Board is gone (403, 404, 410) is told apart from no answer and from an expired sign-in', () => {
  for (const statusCode of [403, 404, 410]) expect(boardIsGone({ statusCode })).toBe(true)
  expect(boardIsGone({ statusCode: 401 })).toBe(false)
  expect(boardIsGone({ statusCode: 500 })).toBe(false)
  expect(boardIsGone(new TypeError('Failed to fetch'))).toBe(false)

  expect(gotNoAnswer(new TypeError('Failed to fetch'))).toBe(true)
  expect(gotNoAnswer({ statusCode: 502, response: { headers: new Headers({ 'x-vercel-error': 'NO_RESPONSE_FROM_FUNCTION' }) } })).toBe(true)
  expect(gotNoAnswer({ statusCode: 500, response: { headers: new Headers() } })).toBe(false)
  expect(gotNoAnswer({ statusCode: 401 })).toBe(false)
  expect(gotNoAnswer({ statusCode: 404 })).toBe(false)
})

test('a Dish History opened with an answer is kept; opened without, the kept one stands in and counts as loaded', async () => {
  const { store, kept } = phone()
  const fake = memoryTransport(boardFixture())
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const online = createBoardModule(board, fake.transport, { kept })
  fake.writeCommentElsewhere('boarda', 'Sehr gut')
  expect(await online.openDish('boarda')).toBe(true)

  // A fresh start with no answer.
  fake.setAnswers('none')
  const board2 = ref<BoardView | undefined>(structuredClone(fake.server))
  const restarted = createBoardModule(board2, fake.transport, { kept: phone(store).kept })
  expect(await restarted.openDish('boarda')).toBe(true)
  expect(restarted.historyOf('boarda').map(e => e.kind === 'comment' && e.comment.text)).toContain('Sehr gut')
  // A Dish never opened here has nothing to show.
  expect(await restarted.openDish('boardb')).toBe(false)
})

test('offline, opening a Dish asks nothing of malkochen', async () => {
  const { kept } = phone()
  const fake = memoryTransport(boardFixture())
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  let offline = false
  const module = createBoardModule(board, fake.transport, { kept, offline: () => offline })
  const asked = () => fake.sent.filter(s => s.startsWith('openDish')).length
  await module.openDish('boarda')
  expect(asked()).toBe(1)
  // A beat, so the History is kept.
  await new Promise(resolve => setTimeout(resolve))
  offline = true
  board.value!.newInHistoryDishIds = ['boarda']

  expect(await module.openDish('boarda')).toBe(true)
  expect(asked()).toBe(1)
  // Not opened, so what is new in it stays marked.
  expect(board.value!.newInHistoryDishIds).toEqual(['boarda'])
})

test('signing out removes everything; another user signing in removes the other one\'s Boards but not their Unsent Changes', async () => {
  const store = memoryStore()
  const mine = createKeptBoards({ store, userId: 'me' })
  const theirs = createKeptBoards({ store, userId: 'them' })
  await mine.opened(boardFixture())
  await theirs.opened(boardFixture('other', 'anders'))
  await store.unsent.save('me', [{ id: 'u1', boardId: 'board', madeAt: '2026-10-01T12:00:00.000Z', label: 'x', kind: 'cook', dishId: 'boarda', cookingId: 'c1' }])

  await store.forgetUser('me')
  expect(await mine.board('board')).toBeNull()
  expect(await mine.landing()).toBeNull()
  expect(await theirs.board('other')).not.toBeNull()
  expect(await store.unsent.load('me')).toHaveLength(1)

  await store.clear()
  expect(await theirs.board('other')).toBeNull()
  expect(await store.unsent.load('me')).toEqual([])
})

test('storage that is blocked answers nothing and keeps nothing, and nothing throws', async () => {
  const store = memoryStore()
  store.broken()
  const kept = createKeptBoards({ store, userId: 'me' })

  await kept.opened(boardFixture())
  expect(await kept.board('board')).toBeNull()
  expect(await kept.landing()).toBeNull()
  expect(await kept.listings()).toEqual([])
  await kept.keepListings([])
  await kept.remove('board')
})
