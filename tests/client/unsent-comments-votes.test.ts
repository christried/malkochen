import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule, WriteFailed } from '../../app/board/board-module'
import { createUnsentChanges, type SendRun } from '../../app/board/unsent-changes'
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { memoryStore } from './memory-device-store'
import { memoryTransport } from './memory-transport'

// Seam 4 again: Comments, Votes and title edits as Unsent Changes (spec #456,
// ticket #460), through the Board module and its Dish History, against the
// in-memory transport and device store.

const me = { id: 'me', name: 'Ich', image: null }

function dish(id: string): DishView {
  return { id, code: `c${id}`, title: `Titel ${id}`, source: null, creator: null, caption: null, playableVideo: null, recipe: null, recipeSearch: null, imageUrl: null, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [], votes: [], commentCount: 0 }
}

// A Board with Ideen (a, b), and Gekocht (d, cooked once).
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
      { id: 'ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('a'), dish('b')] },
      { id: 'gekocht', name: 'Gekocht', subtitle: null, isGekocht: true, dishes: [{ ...dish('d'), cookings: [{ id: 'k1', cookedAt: '2026-10-02T12:00:00.000Z', recordedBy: null }] }] },
    ],
  }
}

function phone(fake = memoryTransport(boardFixture()), store = memoryStore()) {
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'me' })
  const module = createBoardModule(board, fake.transport, { unsent })
  const dishOf = (id: string) => board.value!.columns.flatMap(c => c.dishes).find(d => d.id === id)!
  const texts = (id: string) => module.historyOf(id).flatMap(e => e.kind === 'comment' ? [e.comment.text] : [])
  return { fake, store, board, unsent, module, dishOf, texts }
}

async function answerAgain(fake: { setAnswers: (mode: 'answering') => void }) {
  await new Promise(resolve => setTimeout(resolve, 0))
  fake.setAnswers('answering')
}

const asRun = (outcome: Awaited<ReturnType<ReturnType<typeof createUnsentChanges>['send']>>) => outcome as SendRun
const onServer = (fake: ReturnType<typeof memoryTransport>, dishId: string) => (fake.comments.get(dishId) ?? []).filter(c => !c.deleted)

test('a Comment that gets no answer stays on screen, is counted and unsent, and arrives with its device id and time', async () => {
  const { fake, module, unsent, dishOf, texts } = phone()
  await module.openDish('a')
  fake.setAnswers('none')

  const written = module.writeComment('a', 'Lecker', me)!
  const ended = await written.settled
  const commentId = written.comment.id

  expect(ended).toMatchObject({ unsent: true })
  expect(ended).not.toHaveProperty('notice')
  expect(texts('a')).toEqual(['Lecker'])
  expect(dishOf('a').commentCount).toBe(1)
  expect(unsent.changes.value).toMatchObject([{ kind: 'comment', dishId: 'a', commentId, text: 'Lecker' }])
  expect(commentId).not.toBe('')

  await answerAgain(fake)
  expect(asRun(await unsent.send())).toMatchObject({ sent: 1, emptied: true })
  expect(onServer(fake, 'a')).toMatchObject([{ id: commentId, text: 'Lecker', createdAt: written.comment.createdAt }])
})

test('a Comment is written with its device id online too, and a refusal rolls it back as ever', async () => {
  const { fake, module, unsent, dishOf, texts } = phone()
  await module.openDish('a')

  const written = module.writeComment('a', 'Hallo', me)!
  expect(written.comment.id).toBe('')
  expect(await written.settled).not.toHaveProperty('unsent')
  expect(onServer(fake, 'a')[0]!.id).toBe(written.comment.id)
  expect(written.comment.id).not.toBe('')

  fake.failNext('writeComment', 403)
  const refused = await module.writeComment('a', 'Nein', me)!.settled
  expect(refused).toMatchObject({ notice: 'commentNotAllowed' })
  expect(texts('a')).toEqual(['Hallo'])
  expect(dishOf('a').commentCount).toBe(1)
  expect(unsent.count.value).toBe(0)
})

test('a Comment whose answer was lost, sent again, is recorded once', async () => {
  const { fake, module, unsent } = phone()
  await module.openDish('a')
  fake.setAnswers('lost')

  const written = module.writeComment('a', 'Einmal', me)!
  expect(await written.settled).toMatchObject({ unsent: true })
  expect(onServer(fake, 'a')).toHaveLength(1)

  await answerAgain(fake)
  await unsent.send()

  expect(onServer(fake, 'a')).toHaveLength(1)
  expect(fake.server.columns[0]!.dishes[0]!.commentCount).toBe(1)
  expect(unsent.count.value).toBe(0)
})

test('editing and deleting a Comment that is itself unsent works, and all go out in order', async () => {
  const { fake, module, unsent, texts } = phone()
  await module.openDish('a')
  fake.setAnswers('none')

  const first = module.writeComment('a', 'Erst', me)!
  await first.settled
  const second = module.writeComment('a', 'Zweit', me)!
  await second.settled
  const edited = module.editComment('a', first.comment.id, 'Erst, besser')!
  expect(await edited.settled).toMatchObject({ unsent: true })
  const deleted = module.deleteComment('a', second.comment.id)!
  await deleted.settled

  expect(texts('a')).toEqual(['Erst, besser'])
  expect(unsent.changes.value.map(c => c.kind)).toEqual(['comment', 'comment', 'commentEdit', 'commentDelete'])

  await answerAgain(fake)
  fake.sent.length = 0
  expect(asRun(await unsent.send())).toMatchObject({ sent: 4, dropped: [] })
  expect(fake.sent.map(s => s.split(' ')[0])).toEqual(['writeComment', 'writeComment', 'editComment', 'deleteComment'])
  expect(onServer(fake, 'a').map(c => c.text)).toEqual(['Erst, besser'])
})

test('editing and deleting a Comment the server has, while it does not answer, are kept and counted', async () => {
  const fake = memoryTransport(boardFixture())
  const old = fake.writeCommentElsewhere('a', 'Alt')
  const mine = fake.writeCommentElsewhere('a', 'Meins')
  const { module, unsent, dishOf, texts } = phone(fake)
  await module.openDish('a')
  expect(dishOf('a').commentCount).toBe(2)
  fake.setAnswers('none')

  await module.editComment('a', mine.id, 'Meins neu')!.settled
  await module.deleteComment('a', old.id)!.settled

  expect(texts('a')).toEqual(['Meins neu'])
  expect(dishOf('a').commentCount).toBe(1)
  expect(unsent.count.value).toBe(2)

  await answerAgain(fake)
  await unsent.send()
  expect(onServer(fake, 'a').map(c => c.text)).toEqual(['Meins neu'])
})

test('taking back an unsent delete sends nothing; one that already went out is restored', async () => {
  const fake = memoryTransport(boardFixture())
  const old = fake.writeCommentElsewhere('a', 'Alt')
  const { module, unsent, texts } = phone(fake)
  await module.openDish('a')
  fake.setAnswers('none')

  const deleted = module.deleteComment('a', old.id)!
  await deleted.settled
  expect(texts('a')).toEqual([])
  const undone = await deleted.undo!()
  await undone.settled

  expect(texts('a')).toEqual(['Alt'])
  expect(unsent.count.value).toBe(0)
  await answerAgain(fake)
  fake.sent.length = 0
  await unsent.send()
  expect(fake.sent).toEqual([])
  expect(onServer(fake, 'a')).toHaveLength(1)

  const again = module.deleteComment('a', old.id)!
  await again.settled
  expect(onServer(fake, 'a')).toHaveLength(0)
  const restored = await again.undo!()
  await restored.settled
  expect(texts('a')).toEqual(['Alt'])
  expect(onServer(fake, 'a')).toHaveLength(1)
})

test('a Vote given, changed and taken back offline stays on screen, collapses to the last, and is sent with its time', async () => {
  const { fake, module, unsent, dishOf } = phone()
  fake.setAnswers('none')

  const given = module.vote('d', true, me)!
  expect(await given.settled).toMatchObject({ unsent: true })
  expect(dishOf('d').votes).toMatchObject([{ voter: { id: 'me' }, up: true }])
  expect(unsent.count.value).toBe(1)

  await module.vote('d', false, me)!.settled
  expect(dishOf('d').votes).toMatchObject([{ up: false }])
  expect(unsent.changes.value).toMatchObject([{ kind: 'vote', dishId: 'd', up: false }])

  await answerAgain(fake)
  await unsent.send()
  expect(fake.server.columns[1]!.dishes[0]!.votes).toMatchObject([{ voter: { id: 'me' }, up: false }])

  fake.setAnswers('none')
  const takenBack = module.vote('d', null, me)!
  await takenBack.settled
  expect(dishOf('d').votes).toEqual([])
  expect(unsent.changes.value).toMatchObject([{ kind: 'vote', up: null }])
  await answerAgain(fake)
  await unsent.send()
  expect(fake.server.columns[1]!.dishes[0]!.votes).toEqual([])
})

test('a Vote is dated when it was given', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('none')
  const given = module.vote('d', true, me)!
  const tapped = given.vote!.votedAt
  await given.settled
  await new Promise(resolve => setTimeout(resolve, 15))
  await answerAgain(fake)
  await unsent.send()
  expect(fake.server.columns[1]!.dishes[0]!.votes[0]!.votedAt).toBe(tapped)
})

test('a refused Vote rolls back as ever and is not kept', async () => {
  const { fake, module, unsent, dishOf } = phone()
  fake.failNext('setVote', 403)
  const ended = await module.vote('d', true, me)!.settled
  expect(ended).toMatchObject({ notice: 'voteNotAllowed' })
  expect(dishOf('d').votes).toEqual([])
  expect(unsent.count.value).toBe(0)
})

test('a title edit that gets no answer shows on the card, is unsent, and is the only thing sent', async () => {
  const { fake, module, unsent, dishOf } = phone()
  fake.setAnswers('none')

  const result = await module.editDish('a', { title: '  Neuer Titel ' })
  expect(result).toMatchObject({ unsent: true })
  expect(dishOf('a').title).toBe('Neuer Titel')
  expect(unsent.changes.value).toMatchObject([{ kind: 'title', dishId: 'a', title: 'Neuer Titel' }])

  await answerAgain(fake)
  fake.sent.length = 0
  await unsent.send()
  expect(fake.sent).toEqual(['editDish a'])
  expect(fake.server.columns[0]!.dishes[0]!.title).toBe('Neuer Titel')
})

test('an edit of more than the title does not become an Unsent Change, and a refused title edit rejects', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('none')
  await expect(module.editDish('a', { title: 'X', creator: 'Y' })).rejects.toBeInstanceOf(WriteFailed)
  expect(unsent.count.value).toBe(0)

  fake.setAnswers('answering')
  fake.failNext('editDish', 403)
  await expect(module.editDish('a', { title: 'Z' })).rejects.toMatchObject({ status: 403 })
  expect(unsent.count.value).toBe(0)
})

test('a title edit wins over what another Member changed meanwhile', async () => {
  const { fake, module, unsent, dishOf } = phone()
  fake.setAnswers('none')
  await module.editDish('a', { title: 'Meiner' })
  fake.server.columns[0]!.dishes[0]!.title = 'Deren'

  await new Promise(resolve => setTimeout(resolve, 0))
  expect(await module.sync(() => Promise.resolve(structuredClone(fake.server)))).toBe(true)
  expect(dishOf('a').title).toBe('Meiner')

  await answerAgain(fake)
  await unsent.send()
  expect(fake.server.columns[0]!.dishes[0]!.title).toBe('Meiner')
})

test('a Board sync during unsent Comments, Votes and titles keeps them on top', async () => {
  const { fake, module, unsent, dishOf } = phone()
  await module.openDish('a')
  fake.setAnswers('none')
  await module.writeComment('a', 'Hm', me)!.settled
  await module.vote('d', true, me)!.settled
  await module.editDish('b', { title: 'B neu' })

  await new Promise(resolve => setTimeout(resolve, 0))
  expect(await module.sync(() => Promise.resolve(structuredClone(fake.server)))).toBe(true)

  expect(dishOf('a').commentCount).toBe(1)
  expect(dishOf('d').votes).toMatchObject([{ up: true }])
  expect(dishOf('b').title).toBe('B neu')
  expect(unsent.count.value).toBe(3)
})

test('a History load during unsent Comments keeps them on top of what the server says', async () => {
  const fake = memoryTransport(boardFixture())
  const old = fake.writeCommentElsewhere('a', 'Alt')
  const gone = fake.writeCommentElsewhere('a', 'Weg')
  const { module, unsent, texts } = phone(fake)
  await module.openDish('a')
  fake.setAnswers('none')
  await module.writeComment('a', 'Neu', me)!.settled
  await module.editComment('a', old.id, 'Alt, anders')!.settled
  await module.deleteComment('a', gone.id)!.settled

  fake.setAnswers('answering')
  expect(await module.openDish('a')).toBe(true)
  expect(texts('a')).toEqual(['Alt, anders', 'Neu'])

  expect(unsent.count.value).toBe(3)
})

test('unsent Comments survive a closed app and are laid over the reopened History', async () => {
  const fake = memoryTransport(boardFixture())
  const old = fake.writeCommentElsewhere('a', 'Alt')
  const first = phone(fake)
  await first.module.openDish('a')
  fake.setAnswers('none')
  await first.module.writeComment('a', 'Neu', me)!.settled
  await first.module.editComment('a', old.id, 'Alt, anders')!.settled
  await first.unsent.saved()

  const second = phone(fake, first.store)
  fake.setAnswers('answering')
  await second.unsent.ready
  expect(await second.module.openDish('a')).toBe(true)

  expect(second.texts('a')).toEqual(['Alt, anders', 'Neu'])
  expect(second.module.historyLoaded('a')).toBe(true)
  expect(second.module.historyLoaded('b')).toBe(false)
})

test('a late Comment sits in the History by when it was written', async () => {
  const fake = memoryTransport(boardFixture())
  const { module, unsent, texts } = phone(fake)
  await module.openDish('a')
  fake.setAnswers('none')
  await module.writeComment('a', 'Früher', me)!.settled
  await new Promise(resolve => setTimeout(resolve, 15))
  fake.writeCommentElsewhere('a', 'Später')

  await answerAgain(fake)
  await unsent.send()
  expect(await module.openDish('a')).toBe(true)

  expect(texts('a')).toEqual(['Früher', 'Später'])
})

test('a Comment that cannot be applied is dropped and named with its text, and leaves the History', async () => {
  const { fake, module, unsent, dishOf, texts } = phone()
  await module.openDish('a')
  fake.setAnswers('none')
  await module.writeComment('a', 'Verloren?', me)!.settled
  await module.vote('d', true, me)!.settled
  await answerAgain(fake)
  fake.deleteDishElsewhere('a')

  const run = asRun(await unsent.send())

  expect(run).toMatchObject({ sent: 1, emptied: true })
  const dropped = unsent.takeDropped()
  expect(dropped.map(c => [c.kind, c.label, 'text' in c ? c.text : undefined])).toEqual([['comment', 'Titel a', 'Verloren?']])
  expect(dishOf('d').votes).toHaveLength(1)
  fake.server.columns[0]!.dishes.unshift(dish('a'))
  await module.droppedChanges(dropped)
  expect(texts('a')).toEqual([])
})

test('a Comment, Vote or title edit of a Dish the server no longer has is dropped without stopping the rest', async () => {
  const { fake, module, unsent } = phone()
  await module.openDish('a')
  fake.setAnswers('none')
  const edited = module.writeComment('a', 'Hm', me)!
  await edited.settled
  await module.editComment('a', edited.comment.id, 'Hm hm')!.settled
  await module.editDish('a', { title: 'Neu' })
  await module.vote('d', true, me)!.settled
  await answerAgain(fake)
  fake.deleteDishElsewhere('a')

  const run = asRun(await unsent.send())

  expect(run.dropped.map(c => c.kind)).toEqual(['comment', 'commentEdit', 'title'])
  expect(run).toMatchObject({ sent: 1, emptied: true })
})

test('an unsent Comment stays the same object when a History load lays it over again', async () => {
  const { fake, module } = phone()
  await module.openDish('a')
  fake.setAnswers('none')
  const written = module.writeComment('a', 'Bleibt', me)!
  await written.settled

  await answerAgain(fake)
  expect(await module.openDish('a')).toBe(true)

  const shown = module.historyOf('a').flatMap(e => e.kind === 'comment' ? [e.comment] : [])
  expect(shown).toHaveLength(1)
  expect(shown[0]).toBe(written.comment)
})
