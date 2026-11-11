import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule, WriteFailed } from '../../app/board/board-module'
import { createUnsentChanges, layOver, type SendRun } from '../../app/board/unsent-changes'
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { memoryStore } from './memory-device-store'
import { memoryTransport } from './memory-transport'

// Seam 4 again: adding a Dish as an Unsent Change (spec #456, ticket #462),
// through the Board module against the in-memory transport and device store.
// A Dish added while malkochen doesn't answer shows at once on its Board, is
// kept on the device with the id made for it, and is added by the server once
// it answers, which looks the link up then.

const me = { id: 'me', name: 'Ich', image: null }
const LINK = 'https://www.tiktok.com/@mara.kocht/video/7300000000000000001'

function dish(id: string): DishView {
  return { id, code: `c${id}`, title: `Titel ${id}`, source: null, creator: null, caption: null, playableVideo: null, recipe: null, imageUrl: null, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [], votes: [], commentCount: 0 }
}

// A Board with Ideen (a, b), and Gekocht (d).
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
      { id: 'gekocht', name: 'Gekocht', subtitle: null, isGekocht: true, dishes: [dish('d')] },
    ],
  }
}

function phone(fake = memoryTransport(boardFixture()), store = memoryStore()) {
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const unsent = createUnsentChanges({ store, transport: fake.transport, userId: 'me' })
  const module = createBoardModule(board, fake.transport, { unsent })
  const titles = (columnId = 'ideen') => board.value!.columns.find(c => c.id === columnId)!.dishes.map(d => d.title)
  const dishOf = (id: string) => board.value!.columns.flatMap(c => c.dishes).find(d => d.id === id)!
  return { fake, store, board, unsent, module, titles, dishOf }
}

async function answerAgain(fake: { setAnswers: (mode: 'answering') => void }) {
  await new Promise(resolve => setTimeout(resolve, 0))
  fake.setAnswers('answering')
}

const asRun = (outcome: Awaited<ReturnType<ReturnType<typeof createUnsentChanges>['send']>>) => outcome as SendRun
const onServer = (fake: ReturnType<typeof memoryTransport>) => fake.server.columns.flatMap(c => c.dishes)

test('a Dish added by link without a title, while malkochen does not answer, shows at once, is unsent, and arrives looked up', async () => {
  const { fake, module, unsent, titles, dishOf } = phone()
  fake.lookups[LINK] = { title: 'Cremige Pilzpasta', creator: '@mara.kocht', imageUrl: '/images/pilz.jpg' }
  fake.setAnswers('none')

  const added = await module.addDish('board', { title: '', placeholder: 'ramen', source: { link: LINK } }, me)

  expect(added).toMatchObject({ unsent: true, dish: { source: { link: LINK, kind: 'tiktok' }, placeholder: 'ramen', addedBy: me } })
  const id = added.dish.id
  // At the top of the first Column, with the link's site until it has arrived.
  expect(titles()).toEqual(['tiktok.com', 'Titel a', 'Titel b'])
  expect(module.isUnsentAdd(id)).toBe(true)
  expect(unsent.changes.value).toMatchObject([{ kind: 'add', dishId: id, link: LINK, title: null, placeholder: 'ramen', boardId: 'board' }])
  expect(unsent.count.value).toBe(1)

  await answerAgain(fake)
  expect(asRun(await unsent.send())).toMatchObject({ sent: 1, emptied: true })
  expect(onServer(fake).map(d => d.id)).toContain(id)
  expect(fake.server.columns[0]!.dishes[0]).toMatchObject({ id, title: 'Cremige Pilzpasta', creator: '@mara.kocht', imageUrl: '/images/pilz.jpg' })

  // The server's Dish replaces the unsent one on screen, same card.
  module.takeArrivals()
  expect(dishOf(id)).toMatchObject({ title: 'Cremige Pilzpasta', creator: '@mara.kocht', imageUrl: '/images/pilz.jpg', code: expect.stringMatching(/^late/) })
  expect(titles()).toEqual(['Cremige Pilzpasta', 'Titel a', 'Titel b'])
  expect(module.isUnsentAdd(id)).toBe(false)
})

test('a title typed offline stays when the Source shows another; a Dish by hand is added with its title and no link', async () => {
  const { fake, module, unsent, titles } = phone()
  fake.lookups[LINK] = { title: 'Cremige Pilzpasta' }
  fake.setAnswers('none')

  await module.addDish('board', { title: 'Meine Pasta', placeholder: 'bowl', source: { link: LINK } }, me)
  await module.addDish('board', { title: 'Omas Suppe', placeholder: 'eintopf' }, me)
  expect(titles()).toEqual(['Omas Suppe', 'Meine Pasta', 'Titel a', 'Titel b'])
  expect(unsent.changes.value).toMatchObject([{ kind: 'add', title: 'Meine Pasta', link: LINK }, { kind: 'add', title: 'Omas Suppe', link: null }])

  await answerAgain(fake)
  await unsent.send()
  expect(fake.server.columns[0]!.dishes.map(d => d.title)).toEqual(['Omas Suppe', 'Meine Pasta', 'Titel a', 'Titel b'])
  expect(fake.server.columns[0]!.dishes[0]!.source).toBeNull()
})

test('a Dish added while the app knows malkochen is out of reach is kept without trying the network', async () => {
  const fake = memoryTransport(boardFixture())
  const board = ref<BoardView | undefined>(structuredClone(fake.server))
  const unsent = createUnsentChanges({ store: memoryStore(), transport: fake.transport, userId: 'me' })
  const module = createBoardModule(board, fake.transport, { unsent, offline: () => true })

  const added = await module.addDish('board', { title: 'Dal', placeholder: 'bowl' }, me)

  expect(added).toMatchObject({ unsent: true })
  expect(fake.sent.filter(s => s.startsWith('addDish '))).toEqual([])
})

test('an add with neither a title nor a link, or a photo, or on another Board, is not kept: it fails as ever', async () => {
  const { fake, module } = phone()
  fake.setAnswers('none')

  await expect(module.addDish('board', { title: '', placeholder: 'bowl' }, me)).rejects.toMatchObject({ status: undefined })
  await expect(module.addDish('board', { title: 'Foto', placeholder: 'bowl', photo: { url: '/p.jpg', ticket: 't' } }, me)).rejects.toMatchObject({ status: undefined })
  await expect(module.addDish('another', { title: 'Dal', placeholder: 'bowl' }, me)).rejects.toMatchObject({ status: undefined })
  await expect(module.addDish('board', { title: 'Tour', placeholder: 'bowl', tour: true }, me)).rejects.toMatchObject({ status: undefined })
})

test('a move, a Cooking and a Comment on a Dish added offline are sent after the add, in the order made', async () => {
  const { fake, module, unsent, titles, dishOf } = phone()
  fake.setAnswers('none')
  const added = await module.addDish('board', { title: 'Dal', placeholder: 'bowl' }, me)
  const id = added.dish.id

  expect(await module.moveDish(id, { columnId: 'ideen', index: 2 })!.settled).toMatchObject({ unsent: true })
  expect(titles()).toEqual(['Titel a', 'Titel b', 'Dal'])
  expect(await module.cookDish(id)!.settled).toMatchObject({ unsent: true })
  expect(titles('gekocht')).toEqual(['Dal', 'Titel d'])
  // Comments are offered: its History counts as loaded, and empty.
  expect(await module.openDish(id)).toBe(true)
  expect(module.historyLoaded(id)).toBe(true)
  expect(module.historyOf(id).map(e => e.kind)).toEqual(['added', 'cooking'])
  expect(fake.sent.filter(s => s.startsWith('openDish'))).toEqual([])
  const written = module.writeComment(id, 'Bald!', me)!
  expect(await written.settled).toMatchObject({ unsent: true })
  expect(dishOf(id).commentCount).toBe(1)

  expect(unsent.changes.value.map(c => c.kind)).toEqual(['add', 'move', 'cook', 'comment'])
  await answerAgain(fake)
  fake.sent.length = 0
  expect(asRun(await unsent.send())).toMatchObject({ sent: 4, dropped: [], emptied: true })
  expect(fake.sent.map(s => s.split(' ')[0])).toEqual(['addDishLate', 'moveDish', 'cookDish', 'writeComment'])
  expect(fake.server.columns.find(c => c.id === 'gekocht')!.dishes[0]).toMatchObject({ id, cookings: [expect.anything()] })
  expect(fake.comments.get(id)).toMatchObject([{ text: 'Bald!' }])
})

test('a Dish whose answer was lost, sent again, is recorded once', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('lost')
  const added = await module.addDish('board', { title: 'Einmal', placeholder: 'bowl', source: { link: LINK } }, me)
  expect(added).toMatchObject({ unsent: true })
  expect(onServer(fake).filter(d => d.title === 'Einmal')).toHaveLength(1)

  await answerAgain(fake)
  expect(asRun(await unsent.send())).toMatchObject({ sent: 1, emptied: true })

  expect(onServer(fake).filter(d => d.title === 'Einmal')).toHaveLength(1)
  expect(unsent.count.value).toBe(0)
})

test('an online save that gets no answer is sent again with the same id, so a lost answer records it once', async () => {
  const { fake, module, unsent } = phone()
  fake.setAnswers('lost')
  const added = await module.addDish('board', { title: 'Online', placeholder: 'bowl' }, me)
  expect(added).toMatchObject({ unsent: true })
  await answerAgain(fake)
  await unsent.send()
  expect(onServer(fake).filter(d => d.title === 'Online')).toHaveLength(1)
})

test('it survives a fresh module over the same device store, and shows again on a loaded Board', async () => {
  const first = phone()
  first.fake.setAnswers('none')
  const added = await first.module.addDish('board', { title: 'Bleibt', placeholder: 'bowl', source: { link: LINK } }, me)
  await first.unsent.saved()

  const second = phone(first.fake, first.store)
  await second.unsent.ready
  expect(second.unsent.changes.value).toMatchObject([{ kind: 'add', dishId: added.dish.id, title: 'Bleibt' }])
  await second.module.layOverUnsent()
  expect(second.titles()).toEqual(['Bleibt', 'Titel a', 'Titel b'])
  // Laid over the same Board again, it is not shown twice.
  await second.module.layOverUnsent()
  expect(second.titles()).toEqual(['Bleibt', 'Titel a', 'Titel b'])
  expect(second.module.isUnsentAdd(added.dish.id)).toBe(true)
})

test('a Board load keeps the Dish on top without duplicating it once the server has it', async () => {
  const { fake, module, unsent, board, titles } = phone()
  fake.setAnswers('none')
  const added = await module.addDish('board', { title: 'Dal', placeholder: 'bowl' }, me)
  await answerAgain(fake)
  await unsent.send()
  // The server has it now; a poll brings the Board with it, still laid over.
  await module.sync(async () => structuredClone(fake.server))
  expect(titles()).toEqual(['Dal', 'Titel a', 'Titel b'])
  expect(board.value!.columns.flatMap(c => c.dishes).filter(d => d.id === added.dish.id)).toHaveLength(1)

  // And a load from before the server had it keeps it on top.
  fake.setAnswers('none')
  const second = await module.addDish('board', { title: 'Reis', placeholder: 'bowl' }, me)
  const staleServer = structuredClone(fake.server)
  await module.sync(async () => structuredClone(staleServer))
  expect(titles()).toEqual(['Reis', 'Dal', 'Titel a', 'Titel b'])
  expect(second.dish.id).toBeTruthy()
})

test('layOver puts a Dish into the first Column once, and leaves the server\'s own when it is there', () => {
  const view = boardFixture()
  const change = { id: 'c1', boardId: 'board', madeAt: '2026-10-05T10:00:00.000Z', label: 'Dal', kind: 'add' as const, dishId: '00000000-0000-4000-8000-000000000abc', link: null, title: 'Dal', placeholder: 'bowl' as const, adder: me }
  layOver(view, [change, change])
  expect(view.columns[0]!.dishes.map(d => d.title)).toEqual(['Dal', 'Titel a', 'Titel b'])
  expect(view.columns[0]!.dishes[0]).toMatchObject({ id: change.dishId, code: '000000000abc', createdAt: change.madeAt })
})

test('an add that is dropped on arrival drops what depends on it, and the Member is told once', async () => {
  const { fake, module, unsent, titles } = phone()
  fake.setAnswers('none')
  const added = await module.addDish('board', { title: 'Weg', placeholder: 'bowl' }, me)
  const id = added.dish.id
  await module.moveDish(id, { columnId: 'ideen', index: 1 })!.settled
  await module.cookDish(id)!.settled
  await module.writeComment(id, 'Hallo', me)!.settled
  const other = module.cookDishes([id, 'a'])!
  await other.settled
  // Something unrelated, which must still go.
  await module.moveDish('b', { columnId: 'gekocht' })!.settled
  expect(unsent.count.value).toBe(6)

  await answerAgain(fake)
  fake.failNext('addDishLate', 403)
  fake.sent.length = 0
  const run = asRun(await unsent.send())

  expect(run.dropped).toMatchObject([{ kind: 'add', dishId: id }])
  expect(unsent.takeDropped()).toHaveLength(1)
  // The cook of both Dishes goes on for the one that is still there.
  expect(fake.sent.map(s => s.split(' ')[0])).toEqual(['addDishLate', 'cookDishes', 'moveDish'])
  expect(fake.sent[1]).toBe('cookDishes a')
  expect(unsent.count.value).toBe(0)
  module.droppedChanges(run.dropped)
  expect(titles()).not.toContain('Weg')
})

test('the Dish that had the same Source on the Board is told on arrival, once', async () => {
  const { fake, module, unsent } = phone()
  fake.server.columns[0]!.dishes[0]!.source = { link: LINK, kind: 'tiktok' }
  fake.setAnswers('none')
  await module.addDish('board', { title: '', placeholder: 'bowl', source: { link: LINK } }, me)

  await answerAgain(fake)
  await unsent.send()

  expect(unsent.takeDuplicates()).toEqual([{ boardId: 'board', title: 'Titel a', columnName: 'Ideen' }])
  expect(unsent.takeDuplicates()).toEqual([])
})

test('what cannot be done to a Dish that is not sent yet is refused', async () => {
  const { fake, module } = phone()
  fake.setAnswers('none')
  const added = await module.addDish('board', { title: 'Dal', placeholder: 'bowl' }, me)
  const id = added.dish.id

  expect(module.deleteDish(id)).toBeNull()
  expect(module.deleteDishes([id])).toBeNull()
  expect(module.moveToBoard(id, { boardId: 'other', columnId: 'x', isGekocht: false })).toBeNull()
  expect(module.moveDishes([id], { columnId: 'gekocht' })).toBeNull()
  expect(module.moveDishes([id], { boardId: 'other', columnId: 'x', isGekocht: false })).toBeNull()
  await expect(module.editDish(id, { creator: 'Jemand' })).rejects.toBeInstanceOf(WriteFailed)
  expect(module.isUnsentAdd(id)).toBe(true)
  expect(module.isUnsentAdd('a')).toBe(false)
})
