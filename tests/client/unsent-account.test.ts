import { expect, test } from 'vitest'
import { createUnsentChanges, type UnsentChange } from '../../app/board/unsent-changes'
import { sendOwnUnsent, settleOtherUnsent, signOutAsking } from '../../app/board/unsent-account'
import { memoryStore } from './memory-device-store'
import { memoryTransport } from './memory-transport'
import type { BoardView } from '../../server/utils/boards'

// Unsent Changes and accounts (spec #456, ticket #463): signing out, an
// expired sign-in and someone else signing in on the same device, over the
// in-memory device store and the Board module's Unsent Changes.

const cook = (id: string): UnsentChange => ({ id, boardId: 'board', madeAt: '2026-10-01T12:00:00.000Z', label: id, kind: 'cook', dishId: id, cookingId: `cooking-${id}` })

const dish = (id: string) => ({ id, code: `c${id}`, title: id, source: null, creator: null, caption: null, playableVideo: null, recipe: null, imageUrl: null, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [], votes: [], commentCount: 0 })
const emptyBoard = { id: 'board', slug: 'b', name: 'B', emoji: 'x', isOwner: true, permissions: [], version: 0, inviteToken: 't', members: [], newDishIds: [], newInHistoryDishIds: [], asOperator: false, columns: [{ id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a'), dish('b')] }, { id: 'gekocht', name: 'Gekocht', subtitle: null, isGekocht: true, dishes: [] }] } as unknown as BoardView

async function keep(store: ReturnType<typeof memoryStore>, userId: string, ...ids: string[]) {
  await store.unsent.save(userId, ids.map(cook))
}

test('signing out with Unsent Changes asks with their count; going ahead signs out and discards them', async () => {
  const asked: number[] = []
  const done: string[] = []
  const outcome = await signOutAsking({
    count: async () => 3,
    ask: async (count) => { asked.push(count); return true },
    signOut: async () => { done.push('signOut'); return true },
    forget: async () => { done.push('forget') },
  })
  expect(outcome).toBe('signedOut')
  expect(asked).toEqual([3])
  expect(done).toEqual(['signOut', 'forget'])
})

test('cancelling the question keeps the Unsent Changes and the sign-in', async () => {
  const done: string[] = []
  const outcome = await signOutAsking({
    count: async () => 2,
    ask: async () => false,
    signOut: async () => { done.push('signOut'); return true },
    forget: async () => { done.push('forget') },
  })
  expect(outcome).toBe('kept')
  expect(done).toEqual([])
})

test('without Unsent Changes signing out does not ask', async () => {
  const done: string[] = []
  const outcome = await signOutAsking({
    count: async () => 0,
    ask: async () => { throw new Error('asked') },
    signOut: async () => { done.push('signOut'); return true },
    forget: async () => { done.push('forget') },
  })
  expect(outcome).toBe('signedOut')
  expect(done).toEqual(['signOut', 'forget'])
})

test('a sign-out that did not get through (offline) clears nothing on the device', async () => {
  const done: string[] = []
  const outcome = await signOutAsking({
    count: async () => 1,
    ask: async () => true,
    signOut: async () => false,
    forget: async () => { done.push('forget') },
  })
  expect(outcome).toBe('failed')
  expect(done).toEqual([])
})

test('an expired sign-in keeps the Unsent Changes, and the same user sends them after signing in again', async () => {
  const store = memoryStore()
  const fake = memoryTransport(emptyBoard)
  const first = createUnsentChanges({ store, transport: fake.transport, userId: 'anna' })
  await first.ready
  first.add(cook('a'))
  await first.saved()
  fake.failNext('cookDish', 401)
  expect(await first.send()).toBe('signedOut')
  await first.saved()
  expect(await store.unsent.load('anna')).toHaveLength(1)

  // The app is opened again and anna signs in: a fresh module over the device.
  const again = createUnsentChanges({ store, transport: fake.transport, userId: 'anna' })
  await again.ready
  expect(again.count.value).toBe(1)
  expect(await again.send()).toMatchObject({ sent: 1, emptied: true })
  await again.saved()
  expect(await store.unsent.load('anna')).toEqual([])
})

test('the device finds the Unsent Changes of users other than the one signed in', async () => {
  const store = memoryStore()
  await keep(store, 'anna', 'a', 'b')
  await keep(store, 'ben', 'c')
  await keep(store, 'cleo')
  expect(await store.unsent.holders()).toEqual(expect.arrayContaining([{ userId: 'anna', count: 2 }, { userId: 'ben', count: 1 }]))
  expect(await store.unsent.holders()).toHaveLength(2)
})

test('another user signing in is asked about the earlier one’s changes, with their count, before anything is discarded', async () => {
  const store = memoryStore()
  await keep(store, 'anna', 'a', 'b', 'c')
  const asked: number[] = []
  let leftWith: UnsentChange[] = []
  const outcome = await settleOtherUnsent({
    store,
    userId: 'ben',
    ask: async (count) => {
      asked.push(count)
      leftWith = await store.unsent.load('anna')
      return true
    },
    leave: async () => { throw new Error('left') },
  })
  expect(outcome).toBe('discarded')
  expect(asked).toEqual([3])
  expect(leftWith).toHaveLength(3)
  expect(await store.unsent.load('anna')).toEqual([])
})

test('going ahead never sends the earlier user’s changes as the new user', async () => {
  const store = memoryStore()
  const fake = memoryTransport(emptyBoard)
  await keep(store, 'anna', 'a', 'b')
  await settleOtherUnsent({ store, userId: 'ben', ask: async () => true, leave: async () => {} })
  const ben = createUnsentChanges({ store, transport: fake.transport, userId: 'ben' })
  await ben.ready
  expect(ben.count.value).toBe(0)
  await ben.send()
  expect(fake.sent).toEqual([])
  // Nor does a module that is asked for anna's list through ben's store get any.
  expect(await store.unsent.load('anna')).toEqual([])
})

test('declining leaves the device as it is and signs the new user out, so the first can sign back in and send', async () => {
  const store = memoryStore()
  const fake = memoryTransport(emptyBoard)
  await keep(store, 'anna', 'a')
  let left = 0
  const outcome = await settleOtherUnsent({ store, userId: 'ben', ask: async () => false, leave: async () => { left++ } })
  expect(outcome).toBe('declined')
  expect(left).toBe(1)
  expect(await store.unsent.load('anna')).toHaveLength(1)

  const anna = createUnsentChanges({ store, transport: fake.transport, userId: 'anna' })
  expect(await anna.send()).toMatchObject({ sent: 1, emptied: true })
  expect(fake.sent).toHaveLength(1)
})

test('nothing is asked when no other user has Unsent Changes', async () => {
  const store = memoryStore()
  await keep(store, 'ben', 'x')
  const outcome = await settleOtherUnsent({ store, userId: 'ben', ask: async () => { throw new Error('asked') }, leave: async () => {} })
  expect(outcome).toBe('none')
})


test('Unsent Changes closed with the account do not come back from a send under way', async () => {
  const store = memoryStore()
  const fake = memoryTransport(emptyBoard)
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'anna' })
  await unsent.ready
  unsent.add(cook('a'))
  unsent.add(cook('b'))
  await unsent.saved()
  const held = fake.holdNext('cookDish')
  const run = unsent.send()
  await new Promise(resolve => setTimeout(resolve, 0))
  unsent.close()
  await store.clear()
  held.succeed()
  await run
  await unsent.saved()
  expect(await store.unsent.load('anna')).toEqual([])
  expect(fake.sent.filter(s => s.startsWith('cookDish'))).toHaveLength(1)
})

test('the same user signing in again on a page that is no Board sends their kept changes, once online', async () => {
  const store = memoryStore()
  const fake = memoryTransport(emptyBoard)
  await keep(store, 'anna', 'a', 'b')
  const anna = createUnsentChanges({ store, transport: fake.transport, userId: 'anna' })
  const send = () => anna.send()
  const count = async () => {
    await anna.ready
    return anna.count.value
  }

  // Still offline: nothing is sent, nothing lost.
  expect(await sendOwnUnsent({ online: () => false, stillSignedIn: () => true, count, send })).toBe(false)
  expect(fake.sent).toEqual([])
  // Someone else is signed in by now: not sent as them.
  expect(await sendOwnUnsent({ online: () => true, stillSignedIn: () => false, count, send })).toBe(false)
  expect(fake.sent).toEqual([])

  expect(await sendOwnUnsent({ online: () => true, stillSignedIn: () => true, count, send })).toBe(true)
  expect(fake.sent).toHaveLength(2)
  await anna.saved()
  expect(await store.unsent.load('anna')).toEqual([])
})

test('nothing is sent when the signed-in user has no Unsent Changes', async () => {
  const send = async () => { throw new Error('sent') }
  expect(await sendOwnUnsent({ online: () => true, stillSignedIn: () => true, count: async () => 0, send })).toBe(false)
})
