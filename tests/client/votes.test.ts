import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule } from '../../app/board/board-module'
import type { BoardView } from '../../server/utils/boards'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import type { DishView } from '../../server/utils/dishes'
import { memoryTransport } from './memory-transport'

// Seam 4: Votes (#334) through the client Board module, as optimistic
// writes with undo, against the in-memory transport: a thumb shows on the
// Dish at once, then as the server saved it, and a failed write puts back
// what the server has.

const ME = { id: 'me', name: 'Ich', image: null }
const ADA = { id: 'ada', name: 'Ada', image: null }

function dish(id: string, cookedAt: string[] = []): DishView {
  return {
    id,
    code: `c${id}`,
    title: `Titel ${id}`,
    source: null,
    creator: null,
    caption: null,
    imageUrl: null,
    imageFocus: { x: 50, y: 50 },
    placeholder: 'bowl',
    addedBy: ADA,
    createdAt: '2026-10-01T12:00:00.000Z',
    cookings: cookedAt.map((at, i) => ({ id: `${id}-cooking-${i}`, cookedAt: at, recordedBy: null })).toReversed(),
    votes: [],
    commentCount: 0,
  }
}

// A Board with Ideen (a, never cooked) and Gekocht (b, cooked once, with
// Ada's thumbs down).
function setup() {
  const cooked = dish('b', ['2026-10-02T12:00:00.000Z'])
  cooked.votes = [{ voter: ADA, up: false, votedAt: '2026-10-02T13:00:00.000Z' }]
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
    newInHistoryDishIds: [],
    columns: [
      { id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a')] },
      { id: 'gekocht', name: 'Gekocht', subtitle: 'Schon geschafft!', isGekocht: true, dishes: [cooked] },
    ],
  }
  const board = ref<BoardView | undefined>(structuredClone(fixture))
  const fake = memoryTransport(fixture)
  const module = createBoardModule(board, fake.transport)
  // The Dish's Votes as the Board shows them, as "Ada 👎".
  const votes = (dishId: string) => board.value!.columns.flatMap(c => c.dishes).find(d => d.id === dishId)!.votes
    .map(v => `${v.voter?.name} ${v.up ? '👍' : '👎'}`)
  const onServer = (dishId: string) => fake.server.columns.flatMap(c => c.dishes).find(d => d.id === dishId)!.votes
    .map(v => `${v.voter?.name} ${v.up ? '👍' : '👎'}`)
  return { fake, module, votes, onServer }
}

test('a Vote shows on the Dish at once, after the others, and stays as the server saved it', async () => {
  const { fake, module, votes, onServer } = setup()
  const held = fake.holdNext('setVote')

  const result = module.vote('b', true, ME)!

  expect(votes('b')).toEqual(['Ada 👎', 'Ich 👍'])
  expect(result.vote).toMatchObject({ up: true, voter: ME })
  held.succeed()
  const settled = await result.settled!
  expect(settled.notice).toBeUndefined()
  expect(votes('b')).toEqual(['Ada 👎', 'Ich 👍'])
  expect(onServer('b')).toEqual(['Ada 👎', 'Ich 👍'])
  expect(fake.sent).toEqual(['setVote b true'])
})

test('voting the other thumb changes the Member\'s Vote; the same thumb again sends nothing', async () => {
  const { fake, module, votes } = setup()
  await module.vote('b', true, ME)!.settled

  await module.vote('b', false, ME)!.settled

  expect(votes('b')).toEqual(['Ada 👎', 'Ich 👎'])
  expect(module.vote('b', false, ME)).toBeNull()
  expect(fake.sent).toEqual(['setVote b true', 'setVote b false'])
})

test('taking the Vote back takes it off the Dish at once', async () => {
  const { fake, module, votes, onServer } = setup()
  await module.vote('b', true, ME)!.settled

  const result = module.vote('b', null, ME)!

  expect(votes('b')).toEqual(['Ada 👎'])
  expect(result.vote).toBeNull()
  expect((await result.settled!).notice).toBeUndefined()
  expect(onServer('b')).toEqual(['Ada 👎'])
  expect(fake.sent.at(-1)).toBe('takeBackVote b')
  // Without a Vote, there is nothing to take back.
  expect(module.vote('b', null, ME)).toBeNull()
})

test('"Rückgängig" puts back the Vote the Member had before', async () => {
  const { fake, module, votes, onServer } = setup()
  await module.vote('b', true, ME)!.settled
  const changed = module.vote('b', false, ME)!
  await changed.settled

  const undone = await changed.undo!()

  expect(votes('b')).toEqual(['Ada 👎', 'Ich 👍'])
  expect((await undone.settled!).notice).toBeUndefined()
  expect(onServer('b')).toEqual(['Ada 👎', 'Ich 👍'])
  expect(fake.sent.at(-1)).toBe('setVote b true')
})

test('a Vote whose write fails is back to what the server has, with a notice', async () => {
  const { fake, module, votes } = setup()
  await module.vote('b', true, ME)!.settled
  fake.failNext('setVote', 500)

  const settled = await module.vote('b', false, ME)!.settled!

  expect(settled.notice).toBe('voteFailed')
  expect(votes('b')).toEqual(['Ada 👎', 'Ich 👍'])
})

test('two Votes in a row: the later one shows until it settles, and one that fails goes back to what the server has', async () => {
  const { fake, module, votes } = setup()
  const held = fake.holdNext('setVote')
  const first = module.vote('b', true, ME)!
  fake.failNext('takeBackVote', 500)
  const second = module.vote('b', null, ME)!
  expect(votes('b')).toEqual(['Ada 👎'])

  held.succeed()
  await first.settled
  expect(votes('b')).toEqual(['Ada 👎'])

  expect((await second.settled!).notice).toBe('voteFailed')
  expect(votes('b')).toEqual(['Ada 👎', 'Ich 👍'])
})

test('a Dish that was never Cooked takes no Vote', () => {
  const { fake, module, votes } = setup()

  expect(module.vote('a', true, ME)).toBeNull()
  expect(module.vote('gone', true, ME)).toBeNull()
  expect(votes('a')).toEqual([])
  expect(fake.sent).toEqual([])
})

test('a Vote right after "Gekocht ✓" waits for the Cooking to be recorded', async () => {
  const { fake, module, votes, onServer } = setup()
  const held = fake.holdNext('cookDish')
  const cooked = module.cookDish('a')!

  const voted = module.vote('a', true, ME)!
  expect(votes('a')).toEqual(['Ich 👍'])
  expect(fake.sent).toEqual(['cookDish a'])

  held.succeed()
  await cooked.settled
  expect((await voted.settled!).notice).toBeUndefined()
  expect(onServer('a')).toEqual(['Ich 👍'])
  // The cook's answer, which came first, didn't take it off.
  expect(votes('a')).toEqual(['Ich 👍'])
})

test('a Vote shows in the Dish History, at the time it was set', async () => {
  const { module } = setup()
  const result = module.vote('b', true, ME)!

  expect(module.historyOf('b').map(e => e.kind)).toEqual(['added', 'cooking', 'vote', 'vote'])
  expect(module.historyOf('b').at(-1)).toEqual({ kind: 'vote', at: result.vote!.votedAt, vote: result.vote })
  await result.settled
})
