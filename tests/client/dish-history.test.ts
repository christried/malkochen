import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule } from '../../app/board/board-module'
import type { BoardView } from '../../server/utils/boards'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import type { DishView } from '../../server/utils/dishes'
import { memoryTransport } from './memory-transport'

// Seam 4: the Dish History ("Verlauf", #332) through the client Board
// module: loaded as the detail opens, and its Comments written, edited and
// deleted as optimistic writes with undo, against the in-memory transport.

const ME = { id: 'me', name: 'Ich', image: null }

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
    addedBy: { id: 'ada', name: 'Ada', image: null },
    createdAt: '2026-10-01T12:00:00.000Z',
    // Newest first, as the Board has them.
    cookings: cookedAt.map((at, i) => ({ id: `${id}-cooking-${i}`, cookedAt: at, recordedBy: null })).toReversed(),
    votes: [],
    commentCount: 0,
  }
}

// A Board with Ideen (a) and Gekocht (b, cooked twice).
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
    newInHistoryDishIds: [],
    columns: [
      { id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a')] },
      { id: 'gekocht', name: 'Gekocht', subtitle: 'Schon geschafft!', isGekocht: true, dishes: [dish('b', ['2026-10-02T12:00:00.000Z', '2026-10-04T12:00:00.000Z'])] },
    ],
  }
  const board = ref<BoardView | undefined>(structuredClone(fixture))
  const fake = memoryTransport(fixture)
  const module = createBoardModule(board, fake.transport)
  // The Dish History as the detail shows it, one line per entry.
  const shown = (dishId: string) => module.historyOf(dishId).map((e) => {
    if (e.kind === 'added') return `added ${e.by?.name}`
    if (e.kind === 'cooking') return `cooking ${e.cooking.id}`
    if (e.kind === 'vote') return `vote ${e.vote.voter?.name} ${e.vote.up}`
    return `comment ${e.comment.id || 'pending'} ${e.comment.text}${e.comment.editedAt ? ' (bearbeitet)' : ''}`
  })
  return { board, fake, module, shown }
}

test('before it has loaded, the Dish History shows who added the Dish and its Cookings, oldest first', () => {
  const { shown } = setup()

  expect(shown('b')).toEqual(['added Ada', 'cooking b-cooking-0', 'cooking b-cooking-1'])
  expect(shown('a')).toEqual(['added Ada'])
  expect(shown('gone')).toEqual([])
})

test('once loaded, its Comments show among the Cookings in time order', async () => {
  const { fake, module, shown } = setup()
  const early = fake.writeCommentElsewhere('b', 'Machen wir Freitag?')
  fake.comments.get('b')![0]!.createdAt = '2026-10-01T18:00:00.000Z'
  const late = fake.writeCommentElsewhere('b', 'Wieder super')
  fake.comments.get('b')![1]!.createdAt = '2026-10-05T18:00:00.000Z'

  expect(await module.openDish('b')).toBe(true)

  expect(shown('b')).toEqual([
    'added Ada',
    `comment ${early.id} Machen wir Freitag?`,
    'cooking b-cooking-0',
    'cooking b-cooking-1',
    `comment ${late.id} Wieder super`,
  ])
})

test('a history that fails to load leaves the Dish History without Comments', async () => {
  const { fake, module, shown } = setup()
  fake.writeCommentElsewhere('a', 'Hallo')
  fake.failNext('openDish', 500)

  expect(await module.openDish('a')).toBe(false)
  expect(shown('a')).toEqual(['added Ada'])
})

test('a written Comment shows at the end at once, trimmed, and is filled in once the server has it', async () => {
  const { fake, module, shown } = setup()
  await module.openDish('a')
  const held = fake.holdNext('writeComment')

  const result = module.writeComment('a', '  Lecker!  ', ME)!

  expect(shown('a')).toEqual(['added Ada', 'comment pending Lecker!'])
  expect(result.comment).toMatchObject({ id: '', text: 'Lecker!', author: ME })
  held.succeed()
  const settled = await result.settled!
  expect(settled.notice).toBeUndefined()
  expect(shown('a')).toEqual(['added Ada', 'comment comment-1 Lecker!'])
  // The same object, filled in, so the history keeps its entry.
  expect(module.historyOf('a').at(-1)).toEqual({ kind: 'comment', at: result.comment.createdAt, comment: result.comment })
  expect(settled.comment).toBe(result.comment)
})

test('a Comment whose write fails goes again, with a notice, and its text for the field', async () => {
  const { fake, module, shown } = setup()
  await module.openDish('a')
  fake.failNext('writeComment', 500)

  const settled = await module.writeComment('a', 'Zu salzig', ME)!.settled!

  expect(settled).toMatchObject({ notice: 'commentFailed', comment: { text: 'Zu salzig' } })
  expect(shown('a')).toEqual(['added Ada'])
})

test('an empty or too long Comment is never sent', () => {
  const { fake, module } = setup()

  expect(module.writeComment('a', '   ', ME)).toBeNull()
  expect(module.writeComment('a', 'x'.repeat(1001), ME)).toBeNull()
  expect(fake.sent).toEqual([])
})

test('an edit shows the new text marked "bearbeitet" at once, then as the server saved it', async () => {
  const { fake, module, shown } = setup()
  const { id } = fake.writeCommentElsewhere('a', 'Zu salzig')
  await module.openDish('a')
  const held = fake.holdNext('editComment')

  const result = module.editComment('a', id, ' Etwas zu salzig ')!

  expect(shown('a')).toEqual(['added Ada', `comment ${id} Etwas zu salzig (bearbeitet)`])
  held.succeed()
  expect((await result.settled!).notice).toBeUndefined()
  expect(shown('a')).toEqual(['added Ada', `comment ${id} Etwas zu salzig (bearbeitet)`])
  expect(fake.sent).toContain(`editComment ${id} Etwas zu salzig`)
})

test('an edit that fails puts the Comment back as it was, with a notice; the same text again sends nothing', async () => {
  const { fake, module, shown } = setup()
  const { id } = fake.writeCommentElsewhere('a', 'Zu salzig')
  await module.openDish('a')
  fake.failNext('editComment', 500)

  expect((await module.editComment('a', id, 'Viel zu salzig')!.settled!).notice).toBe('commentEditFailed')
  expect(shown('a')).toEqual(['added Ada', `comment ${id} Zu salzig`])

  expect(module.editComment('a', id, ' Zu salzig')!.settled).toBeUndefined()
  expect(fake.sent.filter(s => s.startsWith('editComment'))).toHaveLength(1)
})

test('two edits in a row: the later one shows until it settles, and one that fails goes back to what the server has', async () => {
  const { fake, module, shown } = setup()
  const { id } = fake.writeCommentElsewhere('a', 'Eins')
  await module.openDish('a')
  const held = fake.holdNext('editComment')

  const first = module.editComment('a', id, 'Zwei')!
  fake.failNext('editComment', 500)
  const second = module.editComment('a', id, 'Drei')!
  expect(shown('a')).toEqual(['added Ada', `comment ${id} Drei (bearbeitet)`])
  held.succeed()
  await first.settled
  expect(shown('a')).toEqual(['added Ada', `comment ${id} Drei (bearbeitet)`])

  expect((await second.settled!).notice).toBe('commentEditFailed')
  expect(shown('a')).toEqual(['added Ada', `comment ${id} Zwei (bearbeitet)`])
})

test('deleting a Comment takes it out at once; "Rückgängig" brings it back in its place, and as the server restored it', async () => {
  const { fake, module, shown } = setup()
  const first = fake.writeCommentElsewhere('a', 'Eins')
  const second = fake.writeCommentElsewhere('a', 'Zwei')
  await module.openDish('a')

  const result = module.deleteComment('a', first.id)!

  expect(result.notice).toBe('commentDeleted')
  expect(shown('a')).toEqual(['added Ada', `comment ${second.id} Zwei`])
  expect((await result.settled!).notice).toBeUndefined()
  const undone = await result.undo!()
  expect(shown('a')).toEqual(['added Ada', `comment ${first.id} Eins`, `comment ${second.id} Zwei`])
  expect((await undone.settled!).notice).toBeUndefined()
  expect(fake.sent.slice(-2)).toEqual([`deleteComment ${first.id}`, `restoreComment ${first.id}`])
})

test('a delete that fails puts the Comment back, with a notice', async () => {
  const { fake, module, shown } = setup()
  const { id } = fake.writeCommentElsewhere('a', 'Bleibt')
  await module.openDish('a')
  fake.failNext('deleteComment', 500)

  expect((await module.deleteComment('a', id)!.settled!).notice).toBe('commentDeleteFailed')
  expect(shown('a')).toEqual(['added Ada', `comment ${id} Bleibt`])
})

test('undo pressed while the delete is under way waits for it, then brings the Comment back', async () => {
  const { fake, module, shown } = setup()
  const { id } = fake.writeCommentElsewhere('a', 'Doch nicht')
  await module.openDish('a')
  const held = fake.holdNext('deleteComment')
  const result = module.deleteComment('a', id)!

  const undoing = result.undo!()
  held.succeed()
  await (await undoing).settled

  expect(shown('a')).toEqual(['added Ada', `comment ${id} Doch nicht`])
  expect(fake.sent.slice(-2)).toEqual([`deleteComment ${id}`, `restoreComment ${id}`])
})

test('a Comment another Member deleted already (404) counts as deleted; an undo that fails takes it out again, with a notice', async () => {
  const { fake, module, shown } = setup()
  const { id } = fake.writeCommentElsewhere('a', 'Weg')
  await module.openDish('a')
  fake.deleteCommentElsewhere(id)

  const result = module.deleteComment('a', id)!
  expect((await result.settled!).notice).toBeUndefined()
  fake.failNext('restoreComment', 500)
  const undone = await result.undo!()
  expect(shown('a')).toEqual(['added Ada', `comment ${id} Weg`])

  expect((await undone.settled!).notice).toBe('commentRestoreFailed')
  expect(shown('a')).toEqual(['added Ada'])
})

test('a history loading while the Member writes their first Comment keeps it beside the ones it loaded', async () => {
  const { fake, module, shown } = setup()
  const theirs = fake.writeCommentElsewhere('a', 'Von Ada')
  const heldLoad = fake.holdNext('openDish')
  const loading = module.openDish('a')
  const heldWrite = fake.holdNext('writeComment')
  const written = module.writeComment('a', 'Von mir', ME)!

  heldLoad.succeed()
  await loading
  expect(shown('a')).toEqual(['added Ada', `comment ${theirs.id} Von Ada`, 'comment pending Von mir'])
  heldWrite.succeed()
  await written.settled

  expect(shown('a')).toEqual(['added Ada', `comment ${theirs.id} Von Ada`, 'comment comment-2 Von mir'])
})

test('a history loaded again while a delete is under way doesn\'t bring the Comment back', async () => {
  const { fake, module, shown } = setup()
  const { id } = fake.writeCommentElsewhere('a', 'Weg damit')
  await module.openDish('a')
  const held = fake.holdNext('deleteComment')
  module.deleteComment('a', id)

  await module.openDish('a')

  expect(shown('a')).toEqual(['added Ada'])
  held.succeed()
})

test('Cookings recorded and deleted on the Board show in the Dish History at once', async () => {
  const { module, shown } = setup()
  await module.openDish('b')

  const cooked = module.cookDish('b')!
  expect(shown('b')).toEqual(['added Ada', 'cooking b-cooking-0', 'cooking b-cooking-1', 'cooking '])
  await cooked.settled
  expect(shown('b')).toEqual(['added Ada', 'cooking b-cooking-0', 'cooking b-cooking-1', 'cooking cooking-1'])

  module.deleteCooking('b', 'b-cooking-0')
  expect(shown('b')).toEqual(['added Ada', 'cooking b-cooking-1', 'cooking cooking-1'])
})
