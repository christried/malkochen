import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule, WriteFailed } from '../../app/board/board-module'
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import { memoryTransport, type MemoryTransport } from './memory-transport'

// Seam 4: the client Board module, through its operations. The Board goes
// in, operations run against the in-memory transport (a fake server), and
// the tests look at the Board and at what each operation answers.

function dish(id: string): DishView {
  return { id, code: `c${id}`, title: `Titel ${id}`, source: null, creator: null, imageUrl: null, imageFocus: { x: 50, y: 50 }, placeholder: 'bowl', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [], votes: [] }
}

// A Board with Ideen (a, b, c), Diese Woche (d) and Gekocht (empty).
function boardFixture(): BoardView {
  return {
    id: 'board',
    slug: 'kochclub',
    name: 'Kochclub',
    emoji: '🍜',
    isOwner: true,
    inviteToken: 'token',
    members: [],
    newDishIds: [],
    columns: [
      { id: 'ideen', name: 'Ideen', subtitle: 'Worauf hast du Lust?', isGekocht: false, dishes: [dish('a'), dish('b'), dish('c')] },
      { id: 'woche', name: 'Diese Woche', subtitle: 'Das steht an.', isGekocht: false, dishes: [dish('d')] },
      { id: 'gekocht', name: 'Gekocht', subtitle: 'Schon geschafft!', isGekocht: true, dishes: [] },
    ],
  }
}

// Another of the Member's Boards: Feierabend, with Ideen (e) and Gekocht
// (empty).
function otherBoardFixture(): BoardView {
  return {
    ...boardFixture(),
    id: 'feierabend',
    name: 'Feierabend',
    emoji: '🌙',
    columns: [
      { id: 'f-ideen', name: 'Ideen', subtitle: null, isGekocht: false, dishes: [dish('e')] },
      { id: 'f-gekocht', name: 'Gekocht', subtitle: 'Schon geschafft!', isGekocht: true, dishes: [] },
    ],
  }
}

// `adjust` changes the fixture before the Board and the server get it.
function setup(adjust: (board: BoardView) => void = () => {}) {
  const fixture = boardFixture()
  adjust(fixture)
  const board = ref<BoardView | undefined>(structuredClone(fixture))
  const fake = memoryTransport(fixture, [otherBoardFixture()])
  const module = createBoardModule(board, fake.transport)
  // Each Column's Dish ids, as the Board shows them.
  const shown = () => Object.fromEntries(board.value!.columns.map(c => [c.id, c.dishes.map(d => d.id)]))
  // A Dish's Cooking ids, as its Cooking History shows them.
  const history = (dishId: string) => board.value!.columns.flatMap(c => c.dishes).find(d => d.id === dishId)!.cookings.map(c => c.id)
  return { board, fake, module, shown, history }
}

// How the module's sync asks the server for the Board: it answers at once
// with the Board as it has it.
function askServer(fake: MemoryTransport) {
  return () => Promise.resolve(structuredClone(fake.server))
}

// The same, but the server answers with the Board as it read it when asked
// only once the test says so (`answer`).
function askServerSlowly(fake: MemoryTransport) {
  let answer = () => {}
  const ask = () => {
    const read = structuredClone(fake.server)
    return new Promise<BoardView>(resolve => (answer = () => resolve(read)))
  }
  return { ask, answer: () => answer() }
}

test('a delete that fails puts the Dish back where it was, with a notice', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('deleteDish', 500)

  const result = module.deleteDish('b')!
  expect(shown().ideen).toEqual(['a', 'c'])

  expect(await result.settled).toMatchObject({ notice: 'deleteFailed' })
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
})

test('a Dish another Member deleted already (404) counts as deleted, and undo still brings it back', async () => {
  const { fake, module, shown } = setup()
  fake.deleteDishElsewhere('b')

  const result = module.deleteDish('b')!

  expect(await result.settled).not.toHaveProperty('notice')
  expect(shown().ideen).toEqual(['a', 'c'])
  const undone = await result.undo!()
  expect(await undone.settled).not.toHaveProperty('notice')
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(fake.sent).toEqual(['deleteDish b', 'restoreDish b'])
})

test('undo pressed while the delete is still under way waits for it, then puts the Dish back and focuses it at once', async () => {
  const { fake, module, shown } = setup()
  const deleting = fake.holdNext('deleteDish')
  const result = module.deleteDish('b')!

  const undone = result.undo!()
  await Promise.resolve()
  expect(fake.sent).toEqual(['deleteDish b'])
  expect(shown().ideen).toEqual(['a', 'c'])

  const restoring = fake.holdNext('restoreDish')
  deleting.succeed()
  const back = await undone
  expect(back).toMatchObject({ focus: { dish: 'b' } })
  expect(shown().ideen).toEqual(['a', 'b', 'c'])

  restoring.succeed()
  expect(await back.settled).not.toHaveProperty('notice')
  expect(fake.sent).toEqual(['deleteDish b', 'restoreDish b'])
  expect(fake.server.columns[0]!.dishes.map(d => d.id)).toEqual(['a', 'b', 'c'])
})

test('an undo that fails takes the Dish off the Board again, with a notice', async () => {
  const { fake, module, shown } = setup()
  const result = module.deleteDish('b')!
  await result.settled
  fake.failNext('restoreDish', 500)

  expect(await (await result.undo!()).settled).toMatchObject({ notice: 'restoreFailed' })
  expect(shown().ideen).toEqual(['a', 'c'])
})

test('undo after a poll took away the Column another Member deleted puts the Dish where the server restored it', async () => {
  const { fake, module, shown } = setup()
  const result = module.deleteDish('d')!
  await result.settled
  fake.deleteColumnElsewhere('woche')
  await module.sync(askServer(fake))
  expect(shown()).toEqual({ ideen: ['a', 'b', 'c'], gekocht: [] })

  const undone = await result.undo!()
  expect(undone).not.toHaveProperty('focus')
  expect(await undone.settled).toMatchObject({ focus: { dish: 'd' } })
  expect(shown()).toEqual({ ideen: ['d', 'a', 'b', 'c'], gekocht: [] })
})

test('after a delete, focus goes to the Dish now in its place, else the one above, else its Column', () => {
  const { module } = setup()

  expect(module.deleteDish('b')).toMatchObject({ focus: { dish: 'c' } })
  expect(module.deleteDish('c')).toMatchObject({ focus: { dish: 'a' } })
  expect(module.deleteDish('d')).toMatchObject({ focus: { column: 'woche' } })
})

test('after a move away, focus goes to the Dish now in its place, else its Column', () => {
  const { module } = setup()

  expect(module.moveDish('b', { columnId: 'woche' })).toMatchObject({ focus: { dish: 'c' } })
  expect(module.moveDish('d', { columnId: 'gekocht' })).toMatchObject({ focus: { dish: 'b' } })
  expect(module.moveDish('b', { columnId: 'ideen' })).toMatchObject({ focus: { column: 'woche' } })
})

test('leaving the Dish detail, focus goes to its card while on the Board, else to the Dish that took its place', () => {
  const { module } = setup()

  // Moved within the Board, cooked out of its Column: its card is still there.
  module.moveDish('a', { columnId: 'woche' })
  expect(module.focusAfterDetail('a')).toEqual({ dish: 'a' })
  module.cookDish('d')
  expect(module.focusAfterDetail('d')).toEqual({ dish: 'd' })
  // Deleted, or moved to another Board: what took its place then.
  module.deleteDish('b')
  expect(module.focusAfterDetail('b')).toEqual({ dish: 'c' })
  module.moveToBoard('c', { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })
  expect(module.focusAfterDetail('c')).toEqual({ column: 'ideen' })
})

test('leaving the Dish detail of a Dish whose delete was undone, or failed, focus goes to its card', async () => {
  const { fake, module } = setup()

  const deleted = module.deleteDish('b')!
  await deleted.settled
  await (await deleted.undo!()).settled
  expect(module.focusAfterDetail('b')).toEqual({ dish: 'b' })

  fake.failNext('deleteDish', 500)
  await module.deleteDish('a')!.settled
  expect(module.focusAfterDetail('a')).toEqual({ dish: 'a' })
})

test('leaving the Dish detail of a Dish another Member took off the Board, focus goes nowhere', async () => {
  const { board, module } = setup()
  // Deleted here and undone before, so it once had somewhere to go.
  const deleted = module.deleteDish('b')!
  await deleted.settled
  await (await deleted.undo!()).settled
  // As a poll would bring it.
  board.value!.columns[0]!.dishes.splice(1, 1)

  expect(module.focusAfterDetail('b')).toBeNull()
})

test('a move that fails puts the Dish back exactly where it was, with a notice', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('moveDish', 500)

  const result = module.moveDish('b', { columnId: 'woche' })!
  expect(shown()).toMatchObject({ ideen: ['a', 'c'], woche: ['b', 'd'] })

  expect(await result.settled).toMatchObject({ notice: 'moveFailed' })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'] })
})

test('a Dish dropped past the end of a Column the server has fewer Dishes in settles where the server put it', async () => {
  const { fake, module, shown } = setup()
  // Another Member deleted d; the Board still shows it until the next poll.
  fake.deleteDishElsewhere('d')

  const result = module.moveDish('a', { columnId: 'woche', index: 1 })!
  expect(shown().woche).toEqual(['d', 'a'])

  expect(await result.settled).toMatchObject({ placement: { columnId: 'woche', index: 0 } })
  expect(shown().woche).toEqual(['a', 'd'])
})

test('a move into the Gekocht Column records a Cooking at once, filled in once settled; a move within it records none', async () => {
  const { board, module, shown } = setup()
  const cookingsOf = (id: string) => board.value!.columns.flatMap(c => c.dishes).find(d => d.id === id)!.cookings

  const into = module.moveDish('a', { columnId: 'gekocht' })!
  expect(into).toMatchObject({ notice: 'cook', cooking: { recordedBy: null } })
  expect(cookingsOf('a')).toHaveLength(1)
  const recorded = (await into.settled)!.cooking!
  expect(recorded.id).toBeTruthy()
  expect(cookingsOf('a')).toEqual([recorded])

  await module.moveDish('b', { columnId: 'gekocht' })!.settled
  expect(shown().gekocht).toEqual(['b', 'a'])
  const within = module.moveDish('a', { columnId: 'gekocht', index: 0 })!
  expect(within).not.toHaveProperty('cooking')
  expect(within).not.toHaveProperty('notice')
  expect(await within.settled).not.toHaveProperty('cooking')
  expect(shown().gekocht).toEqual(['a', 'b'])
  expect(cookingsOf('a')).toEqual([recorded])
})

test('"Gekocht ✓" on a Dish another Member deleted already records no Cooking, and the Dish just goes', async () => {
  const { board, fake, module, shown } = setup()
  fake.deleteDishElsewhere('b')

  const result = module.cookDish('b')!
  expect(result).toMatchObject({ notice: 'cook', focus: { dish: 'c' } })
  expect(shown().gekocht).toEqual(['b'])

  const settled = await result.settled
  expect(settled).not.toHaveProperty('cooking')
  expect(settled).not.toHaveProperty('notice')
  expect(shown()).toMatchObject({ ideen: ['a', 'c'], gekocht: [] })
  expect(board.value!.columns.flatMap(c => c.dishes).flatMap(d => d.cookings)).toEqual([])
})

test('"Gekocht ✓" on a Dish already in the Gekocht Column records another Cooking and leaves it where it is', async () => {
  const { module, shown } = setup()
  await module.moveDish('a', { columnId: 'gekocht' })!.settled
  await module.moveDish('b', { columnId: 'gekocht' })!.settled

  const result = module.cookDish('a')!
  expect(result).toMatchObject({ notice: 'cook', focus: { dish: 'a' } })
  expect(result.dish.cookings).toHaveLength(2)

  expect((await result.settled)!.cooking!.id).toBeTruthy()
  expect(shown().gekocht).toEqual(['b', 'a'])
  expect(result.dish.cookings).toHaveLength(2)
})

// The detail's Cooking History keys its entries by these objects: new ones
// for the same Cookings would redraw every entry, and the detail would jump
// as they leave and come in again (#287).
test('"Gekocht ✓" settled keeps the Cookings the Cooking History showed, the new one filled in, as the same objects', async () => {
  const { board, module } = setup(cookedTwice)
  const shownCookings = () => board.value!.columns.flatMap(c => c.dishes).find(d => d.id === 'd')!.cookings

  const result = module.cookDish('d')!
  const before = [...shownCookings()]
  expect(before).toHaveLength(3)

  const recorded = (await result.settled)!.cooking!
  expect(shownCookings().map(c => c.id)).toEqual([recorded.id, 'sept-20', 'sept-1'])
  shownCookings().forEach((cooking, i) => expect(cooking).toBe(before[i]))
})

test('"Gekocht ✓" then a move of the same Dish are sent and applied in that order', async () => {
  const { fake, module, shown } = setup()
  const cooking = fake.holdNext('cookDish')

  const cooked = module.cookDish('b')!
  const moved = module.moveDish('b', { columnId: 'woche' })!
  expect(shown()).toMatchObject({ woche: ['b', 'd'], gekocht: [] })
  await Promise.resolve()
  expect(fake.sent).toEqual(['cookDish b'])

  cooking.succeed()
  const recorded = (await cooked.settled)!.cooking!
  expect(recorded.id).toBeTruthy()
  // The move, still under way, keeps the Dish where it put it.
  expect(shown()).toMatchObject({ woche: ['b', 'd'], gekocht: [] })

  await moved.settled
  expect(fake.sent).toEqual(['cookDish b', 'moveDish b woche'])
  expect(shown()).toMatchObject({ ideen: ['a', 'c'], woche: ['b', 'd'], gekocht: [] })
  expect(moved.dish.cookings).toEqual([recorded])
})

test('"Rückgängig" before the cook has reached the server puts the Dish back at once and leaves no Cooking', async () => {
  const { fake, module, shown } = setup()
  const cooking = fake.holdNext('cookDish')
  const cooked = module.cookDish('b')!

  const undone = await cooked.undo!()
  expect(undone).toMatchObject({ focus: { dish: 'b' } })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], gekocht: [] })
  expect(cooked.dish.cookings).toEqual([])

  cooking.succeed()
  expect(await cooked.settled).not.toHaveProperty('notice')
  expect(await undone.settled).not.toHaveProperty('notice')
  expect(fake.sent).toEqual(['cookDish b', 'undoCooking cooking-1 ideen 1'])
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], gekocht: [] })
  expect(cooked.dish.cookings).toEqual([])
  expect(fake.server.columns[0]!.dishes.map(d => d.id)).toEqual(['a', 'b', 'c'])
  expect(fake.server.columns[0]!.dishes[1]!.cookings).toEqual([])
})

test('an undo of a Cooking that fails cooks the Dish again where it was, with a notice', async () => {
  const { fake, module, shown } = setup()
  const cooked = module.cookDish('b')!
  const recorded = (await cooked.settled)!.cooking!
  fake.failNext('undoCooking', 500)

  const undone = await cooked.undo!()
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], gekocht: [] })
  expect(cooked.dish.cookings).toEqual([])

  expect(await undone.settled).toMatchObject({ notice: 'uncookFailed' })
  expect(shown()).toMatchObject({ ideen: ['a', 'c'], gekocht: ['b'] })
  expect(cooked.dish.cookings).toEqual([recorded])
})

test('"Gekocht ✓" then a move that both fail leave the Dish where it was before either', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('cookDish', 500)
  fake.failNext('moveDish', 500)

  const cooked = module.cookDish('b')!
  const moved = module.moveDish('b', { columnId: 'woche' })!

  expect(await cooked.settled).toMatchObject({ notice: 'cookFailed' })
  expect(await moved.settled).toMatchObject({ notice: 'moveFailed' })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'], gekocht: [] })
  expect(cooked.dish.cookings).toEqual([])
})

// Diese Woche's Dish d, cooked twice: on 20 and on 1 September.
function cookedTwice(board: BoardView) {
  board.columns[1]!.dishes[0]!.cookings = [
    { id: 'sept-20', cookedAt: '2020-09-20T18:00:00.000Z', recordedBy: null },
    { id: 'sept-1', cookedAt: '2020-09-01T18:00:00.000Z', recordedBy: null },
  ]
}

test('deleting a Cooking takes it out of the Cooking History at once; if that fails, it is back with a notice', async () => {
  const { fake, module, history } = setup(cookedTwice)
  fake.failNext('deleteCooking', 500)

  const result = module.deleteCooking('d', 'sept-20')!
  expect(result).toMatchObject({ notice: 'cookingDeleted', cooking: { id: 'sept-20' } })
  expect(history('d')).toEqual(['sept-1'])

  expect(await result.settled).toMatchObject({ notice: 'cookingDeleteFailed' })
  expect(history('d')).toEqual(['sept-20', 'sept-1'])
})

test('a Cooking another Member deleted already (404) counts as deleted, and undo still brings it back', async () => {
  const { fake, module, history } = setup(cookedTwice)
  fake.deleteCookingElsewhere('sept-20')

  const result = module.deleteCooking('d', 'sept-20')!

  expect(await result.settled).not.toHaveProperty('notice')
  expect(history('d')).toEqual(['sept-1'])
  const undone = await result.undo!()
  expect(await undone.settled).not.toHaveProperty('notice')
  expect(history('d')).toEqual(['sept-20', 'sept-1'])
  expect(fake.sent).toEqual(['deleteCooking sept-20', 'restoreCooking sept-20'])
})

test('undo pressed while the Cooking’s delete is still under way waits for it, then puts the Cooking back', async () => {
  const { fake, module, history } = setup(cookedTwice)
  const deleting = fake.holdNext('deleteCooking')
  const result = module.deleteCooking('d', 'sept-20')!

  const undone = result.undo!()
  await Promise.resolve()
  expect(fake.sent).toEqual(['deleteCooking sept-20'])
  expect(history('d')).toEqual(['sept-1'])

  const restoring = fake.holdNext('restoreCooking')
  deleting.succeed()
  const back = await undone
  expect(history('d')).toEqual(['sept-20', 'sept-1'])

  restoring.succeed()
  expect(await back.settled).not.toHaveProperty('notice')
  expect(fake.sent).toEqual(['deleteCooking sept-20', 'restoreCooking sept-20'])
  expect(fake.server.columns[1]!.dishes[0]!.cookings.map(c => c.id)).toEqual(['sept-20', 'sept-1'])
})

test('an undo of a Cooking’s delete that fails takes it out of the Cooking History again, with a notice', async () => {
  const { fake, module, history } = setup(cookedTwice)
  const result = module.deleteCooking('d', 'sept-20')!
  await result.settled
  fake.failNext('restoreCooking', 500)

  const undone = await result.undo!()
  expect(history('d')).toEqual(['sept-20', 'sept-1'])

  expect(await undone.settled).toMatchObject({ notice: 'cookingRestoreFailed' })
  expect(history('d')).toEqual(['sept-1'])
})

test('undo puts a Cooking back in date order after another was added, though its Dish moved to another Column meanwhile', async () => {
  const { module, shown, history } = setup(cookedTwice)
  const result = module.deleteCooking('d', 'sept-20')!
  await result.settled
  // "Gekocht ✓" meanwhile: d goes to the Gekocht Column with a new Cooking.
  const recorded = (await module.cookDish('d')!.settled)!.cooking!
  expect(shown().gekocht).toEqual(['d'])

  await (await result.undo!()).settled
  expect(history('d')).toEqual([recorded.id, 'sept-20', 'sept-1'])
})

test('an added Dish appears where the server placed it, though the Board would have put it elsewhere', async () => {
  const { fake, module, shown } = setup()
  // Another Member put Diese Woche first; the Board doesn't show that yet.
  fake.server.columns.unshift(...fake.server.columns.splice(1, 1))

  const result = await module.addDish('board', { title: 'Chana Masala', placeholder: 'bowl' })

  expect(result.placement).toEqual({ boardId: 'board', columnId: 'woche', index: 0 })
  expect(result.dish.title).toBe('Chana Masala')
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: [result.dish.id, 'd'] })
})

test('a Dish added to another Board doesn’t show on this one, and the result says its image couldn’t be stored', async () => {
  const { board, module, shown } = setup()
  const before = shown()

  // A Source image without its Image Ticket isn't stored.
  const result = await module.addDish('other-board', { title: 'Pho', placeholder: 'ramen', imageUrl: 'https://cdn.example/pho.jpg' })

  expect(result).toMatchObject({ placement: { boardId: 'other-board' }, notice: 'imageNotStored', dish: { title: 'Pho', imageUrl: null } })
  expect(shown()).toEqual(before)
  expect(board.value!.columns.flatMap(c => c.dishes).some(d => d.id === result.dish.id)).toBe(false)
})

// "Eigenes Foto": the Member is told it was their photo that wasn't taken.
test('an added Dish whose own photo the server refused says so, apart from a Source image', async () => {
  const { module } = setup()

  const refused = await module.addDish('board', { title: 'Shakshuka', placeholder: 'bowl', photo: { url: '/images/dishes/foto.jpg', ticket: '' } })
  expect(refused).toMatchObject({ notice: 'photoNotStored', dish: { imageUrl: null } })

  const taken = await module.addDish('board', { title: 'Falafel', placeholder: 'bowl', photo: { url: '/images/dishes/foto.jpg', ticket: 'ticket' } })
  expect(taken).not.toHaveProperty('notice')
  expect(taken.dish.imageUrl).toBe('/images/dishes/foto.jpg')
})

test('an edit replaces the Dish’s fields with what the server saved', async () => {
  const { board, module, shown } = setup()
  const shownDish = () => board.value!.columns[0]!.dishes[1]!

  const result = await module.editDish('b', { title: '  Ofengemüse ', source: { link: 'https://www.tiktok.com/@koch/video/1', kind: 'tiktok' } })

  expect(result).not.toHaveProperty('notice')
  expect(shownDish()).toMatchObject({ id: 'b', title: 'Ofengemüse', source: { link: 'https://www.tiktok.com/@koch/video/1', kind: 'tiktok' } })
  expect(result.dish).toBe(shownDish())
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
})

test('an edit whose new image couldn’t be stored keeps the image it had, and says so', async () => {
  const { board, module } = setup(fixture => (fixture.columns[0]!.dishes[1]!.imageUrl = '/images/b.jpg'))

  const result = await module.editDish('b', { title: 'Neu', imageUrl: 'https://cdn.example/neu.jpg' })

  expect(result).toMatchObject({ notice: 'imageNotReplaced', dish: { title: 'Neu', imageUrl: '/images/b.jpg' } })
  expect(board.value!.columns[0]!.dishes[1]!.imageUrl).toBe('/images/b.jpg')
})

test('an edit saved while "Gekocht ✓" is under way still lets a failed cook put the Dish back, and keeps its new title', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('cookDish', 500)

  const cooked = module.cookDish('b')!
  const edited = module.editDish('b', { title: 'Neu' })

  expect(await cooked.settled).toMatchObject({ notice: 'cookFailed' })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], gekocht: [] })
  expect((await edited).dish.title).toBe('Neu')
  expect(fake.sent).toEqual(['cookDish b', 'editDish b'])
})

test('a move under way when an edit is saved still settles where the server put the Dish', async () => {
  const { fake, module, shown } = setup()
  // Another Member deleted d; the Board still shows it until the next poll.
  fake.deleteDishElsewhere('d')

  const moved = module.moveDish('a', { columnId: 'woche', index: 1 })!
  const edited = module.editDish('a', { title: 'Neu' })

  expect(await moved.settled).toMatchObject({ placement: { columnId: 'woche', index: 0 } })
  expect(shown().woche).toEqual(['a', 'd'])
  expect((await edited).dish.title).toBe('Neu')
})

test('a Dish moved to another Board leaves this one at once, and settles where the server put it there', async () => {
  const { fake, module, shown } = setup()

  const result = module.moveToBoard('b', { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })!

  expect(shown().ideen).toEqual(['a', 'c'])
  expect(result).toMatchObject({ dish: { id: 'b' }, placement: { boardId: 'feierabend', columnId: 'f-ideen', index: 0 }, focus: { dish: 'c' } })
  expect(await result.settled).toEqual({ dish: result.dish, placement: { boardId: 'feierabend', columnId: 'f-ideen', index: 0 } })
  expect(shown().ideen).toEqual(['a', 'c'])
  expect(fake.sent).toEqual(['moveDish b f-ideen'])
})

test('a move to another Board that fails puts the Dish back exactly where it was, with a notice', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('moveDish', 500)

  const result = module.moveToBoard('b', { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })!
  // Deleting Dish a meanwhile moves c up to b's old index: b still goes back above c.
  module.deleteDish('a')

  expect(await result.settled).toEqual({ dish: result.dish, notice: 'moveFailed' })
  expect(shown().ideen).toEqual(['b', 'c'])
})

test('a Dish another Member deleted already (404) stays gone when moved to another Board, without a notice', async () => {
  const { fake, module, shown } = setup()
  fake.deleteDishElsewhere('b')

  const result = module.moveToBoard('b', { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })!

  expect(await result.settled).toEqual({ dish: result.dish })
  expect(shown().ideen).toEqual(['a', 'c'])
})

test('a move then a move to another Board that both fail leave the Dish where it was before either', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('moveDish', 500)
  fake.failNext('moveDish', 500)

  const moved = module.moveDish('b', { columnId: 'woche' })!
  const movedAway = module.moveToBoard('b', { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })!

  expect(await moved.settled).toMatchObject({ notice: 'moveFailed' })
  expect(await movedAway.settled).toMatchObject({ notice: 'moveFailed' })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'] })
  expect(fake.sent).toEqual(['moveDish b woche', 'moveDish b f-ideen'])
})

// "Verschieben nach…" into another Board's Gekocht Column (#129).
const INTO_FEIERABEND_GEKOCHT = { boardId: 'feierabend', columnId: 'f-gekocht', isGekocht: true }

test('a Dish moved into another Board’s Gekocht Column records a Cooking at once, keeps its Cooking History, and offers the Gekocht toast’s undo', async () => {
  const { module, shown } = setup(cookedTwice)

  const result = module.moveToBoard('d', INTO_FEIERABEND_GEKOCHT)!

  expect(shown().woche).toEqual([])
  expect(result).toMatchObject({ notice: 'cook', cooking: { recordedBy: null }, placement: { boardId: 'feierabend', columnId: 'f-gekocht', index: 0 }, focus: { column: 'woche' } })
  expect(result.undo).toBeTypeOf('function')
  expect(result.dish.cookings.map(c => c.id)).toEqual(['', 'sept-20', 'sept-1'])
  const settled = (await result.settled)!
  expect(settled).toMatchObject({ placement: { boardId: 'feierabend', columnId: 'f-gekocht', index: 0 }, cooking: { id: 'cooking-1' } })
  expect(settled).not.toHaveProperty('notice')
  expect(result.dish.cookings.map(c => c.id)).toEqual(['cooking-1', 'sept-20', 'sept-1'])
  expect(shown().woche).toEqual([])
})

test('"Rückgängig" after a move into another Board’s Gekocht Column brings the Dish back where it was, without that Cooking', async () => {
  const { fake, module, shown, history } = setup(cookedTwice)
  const moved = module.moveToBoard('b', INTO_FEIERABEND_GEKOCHT)!
  await moved.settled

  const undone = await moved.undo!()

  expect(undone).toMatchObject({ focus: { dish: 'b' } })
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(history('b')).toEqual([])
  expect(await undone.settled).toMatchObject({ placement: { boardId: 'board', columnId: 'ideen', index: 1 } })
  expect(await undone.settled).not.toHaveProperty('notice')
  expect(fake.sent).toEqual(['moveDish b f-gekocht', 'undoCooking cooking-1 ideen 1'])
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(fake.server.columns[0]!.dishes.map(d => d.id)).toEqual(['a', 'b', 'c'])
  expect(fake.server.columns[0]!.dishes[1]!.cookings).toEqual([])
})

test('"Rückgängig" before the move into another Board’s Gekocht Column has reached the server waits for it, then takes the Cooking off again', async () => {
  const { fake, module, shown, history } = setup()
  const moving = fake.holdNext('moveDish')
  const moved = module.moveToBoard('b', INTO_FEIERABEND_GEKOCHT)!

  const undone = await moved.undo!()
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(history('b')).toEqual([])

  moving.succeed()
  expect(await moved.settled).not.toHaveProperty('notice')
  expect(await undone.settled).not.toHaveProperty('notice')
  expect(fake.sent).toEqual(['moveDish b f-gekocht', 'undoCooking cooking-1 ideen 1'])
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(history('b')).toEqual([])
})

test('an undo of a Cooking recorded on another Board that fails takes the Dish off this Board again, with a notice', async () => {
  const { fake, module, shown } = setup()
  const moved = module.moveToBoard('b', INTO_FEIERABEND_GEKOCHT)!
  const recorded = (await moved.settled)!.cooking!
  fake.failNext('undoCooking', 500)

  const undone = await moved.undo!()
  expect(shown().ideen).toEqual(['a', 'b', 'c'])

  // Focus goes where it went as the Dish left, also once the detail closes.
  expect(await undone.settled).toMatchObject({ notice: 'uncookFailed', focus: { dish: 'c' } })
  expect(shown().ideen).toEqual(['a', 'c'])
  expect(moved.dish.cookings).toEqual([recorded])
  expect(module.focusAfterDetail('b')).toEqual({ dish: 'c' })
})

test('a move into another Board’s Gekocht Column that fails puts the Dish back without a Cooking, with a notice', async () => {
  const { fake, module, shown } = setup(cookedTwice)
  fake.failNext('moveDish', 500)

  const moved = module.moveToBoard('d', INTO_FEIERABEND_GEKOCHT)!

  expect(await moved.settled).toEqual({ dish: moved.dish, notice: 'cookFailed' })
  expect(shown().woche).toEqual(['d'])
  expect(moved.dish.cookings.map(c => c.id)).toEqual(['sept-20', 'sept-1'])
  // Nothing left to undo.
  expect(await moved.undo!()).toEqual({ dish: moved.dish })
  expect(fake.sent).toEqual(['moveDish d f-gekocht'])
})

test('a poll brings other Members’ changes, keeping the Columns and Dishes still there as they were', async () => {
  const { board, fake, module, shown } = setup()
  const ideen = board.value!.columns[0]!
  const a = ideen.dishes[0]!
  fake.server.columns[0]!.dishes.unshift(dish('z'))
  fake.server.columns[0]!.dishes[1]!.title = 'Alans Auflauf'
  fake.deleteDishElsewhere('c')
  fake.server.newDishIds = ['z']

  await module.sync(askServer(fake))

  expect(shown()).toEqual({ ideen: ['z', 'a', 'b'], woche: ['d'], gekocht: [] })
  expect(board.value!.columns[0]).toBe(ideen)
  expect(ideen.dishes[1]).toBe(a)
  expect(a.title).toBe('Alans Auflauf')
  expect(board.value!.newDishIds).toEqual(['z'])
})

test('a poll answered while a write is under way is dropped, so the Board doesn’t flicker back', async () => {
  const { fake, module, shown } = setup()
  const held = fake.holdNext('moveDish')
  const result = module.moveDish('b', { columnId: 'woche' })!

  await module.sync(askServer(fake))
  expect(shown()).toMatchObject({ ideen: ['a', 'c'], woche: ['b', 'd'] })

  held.succeed()
  await result.settled
  expect(shown()).toMatchObject({ ideen: ['a', 'c'], woche: ['b', 'd'] })
})

test('a poll asked before a write and answered after it settled is dropped, as the server read the Board before the write', async () => {
  const { fake, module, shown } = setup()
  const slow = askServerSlowly(fake)
  const polled = module.sync(slow.ask)

  await module.moveDish('b', { columnId: 'woche' })!.settled
  slow.answer()
  await polled

  expect(shown()).toMatchObject({ ideen: ['a', 'c'], woche: ['b', 'd'] })
})

test('a poll between "Gekocht ✓" and its "Rückgängig" leaves the undo working', async () => {
  const { fake, module, shown, history } = setup()
  const cooked = module.cookDish('a')!
  await cooked.settled
  fake.server.columns[0]!.dishes.find(d => d.id === 'c')!.title = 'Neuer Titel'
  await module.sync(askServer(fake))

  const undone = await cooked.undo!()

  expect(await undone.settled).toMatchObject({ placement: { columnId: 'ideen', index: 0 } })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], gekocht: [] })
  expect(history('a')).toEqual([])
  expect(fake.server.columns[2]!.dishes).toEqual([])
})

test('a poll during an undo still under way is dropped, and the undo settles as the server has it', async () => {
  const { fake, module, shown, history } = setup()
  const cooked = module.cookDish('a')!
  await cooked.settled
  const held = fake.holdNext('undoCooking')
  const undone = await cooked.undo!()

  await module.sync(askServer(fake))
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], gekocht: [] })
  expect(history('a')).toEqual([])

  held.succeed()
  expect(await undone.settled).toMatchObject({ placement: { columnId: 'ideen', index: 0 } })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], gekocht: [] })
})

test('a poll answered while a Dish is being dragged is dropped', async () => {
  const { fake, module, shown } = setup()
  fake.deleteDishElsewhere('c')

  await module.sync(askServer(fake), { paused: () => true })

  expect(shown().ideen).toEqual(['a', 'b', 'c'])
})

test('an added Column shows at the end of the Board as the server added it, empty', async () => {
  const { board, fake, module, shown } = setup()

  const added = await module.addColumn('Wochenende')

  expect(fake.sent).toEqual(['addColumn board Wochenende'])
  expect(added).toEqual({ id: fake.server.columns[3]!.id, name: 'Wochenende', subtitle: null, isGekocht: false })
  expect(shown()).toEqual({ ideen: ['a', 'b', 'c'], woche: ['d'], gekocht: [], [added.id]: [] })
  expect(board.value!.columns[3]).toMatchObject({ name: 'Wochenende', subtitle: null, isGekocht: false, dishes: [] })
})

test('an added Column stays though a poll asked before the server added it comes back after', async () => {
  const { fake, module, shown } = setup()
  const slow = askServerSlowly(fake)
  const polled = module.sync(slow.ask)

  const added = await module.addColumn('Wochenende')
  slow.answer()
  await polled

  expect(Object.keys(shown())).toEqual(['ideen', 'woche', 'gekocht', added.id])
})

test('an add that fails rejects, and the Board stays as it was', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('addColumn', 500)

  await expect(module.addColumn('Wochenende')).rejects.toBeInstanceOf(WriteFailed)

  expect(shown()).toEqual({ ideen: ['a', 'b', 'c'], woche: ['d'], gekocht: [] })
})

test('the Dish count is every Dish on the Board, the Gekocht Column’s included; an empty Board counts 0', () => {
  expect(setup(board => board.columns[2]!.dishes.push(dish('g'))).module.dishCount.value).toBe(5)
  expect(setup(board => board.columns.forEach(c => (c.dishes = []))).module.dishCount.value).toBe(0)
})

test('the Dish count rises with an add and falls with a delete, and moves within the Board leave it', async () => {
  const { module } = setup()

  await module.addDish('board', { title: 'Chana Masala', placeholder: 'bowl' })
  expect(module.dishCount.value).toBe(5)

  module.deleteDish('a')
  expect(module.dishCount.value).toBe(4)

  module.moveDish('b', { columnId: 'woche' })
  module.cookDish('c')
  expect(module.dishCount.value).toBe(4)
})

test('the Dish count falls when a Dish moves to another Board', () => {
  const { module } = setup()

  module.moveToBoard('b', { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })

  expect(module.dishCount.value).toBe(3)
})

test('the Dish count follows other Members’ adds and deletes through a poll', async () => {
  const { fake, module } = setup()
  fake.server.columns[0]!.dishes.unshift(dish('y'), dish('z'))
  fake.deleteDishElsewhere('d')

  await module.sync(askServer(fake))

  expect(module.dishCount.value).toBe(5)
})

// Several Dishes at once (#218): the selection's "Verschieben nach…" and
// "Archivieren", one write for all of them, with one "Rückgängig".

test('Dishes selected across Columns move to the top of a Column together, in Board order; one already there stays', async () => {
  const { fake, module, shown } = setup()

  const result = module.moveDishes(['d', 'c', 'a'], { columnId: 'woche' })!

  expect(shown()).toMatchObject({ ideen: ['b'], woche: ['a', 'c', 'd'] })
  expect(result).toMatchObject({ notice: 'movedMany', dishes: [{ id: 'a' }, { id: 'c' }] })
  expect(await result.settled).not.toHaveProperty('notice')
  expect(shown()).toMatchObject({ ideen: ['b'], woche: ['a', 'c', 'd'] })
  expect(fake.sent).toEqual(['moveDishes a,c woche'])
})

test('a move of several that fails puts every Dish back exactly where it was, with a notice', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('moveDishes', 404)

  const result = module.moveDishes(['a', 'b', 'd'], { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })!
  expect(shown()).toMatchObject({ ideen: ['c'], woche: [] })

  expect(await result.settled).toMatchObject({ notice: 'moveManyFailed' })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'] })
})

test('several Dishes never move into a Gekocht Column, here or on another Board', () => {
  const { fake, module, shown } = setup()

  expect(module.moveDishes(['a', 'b'], { columnId: 'gekocht' })).toBeNull()
  expect(module.moveDishes(['a', 'b'], { boardId: 'feierabend', columnId: 'f-gekocht', isGekocht: true })).toBeNull()
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(fake.sent).toEqual([])
})

test('"Rückgängig" after moving several puts each back in its Column and place at once, and as the server put them', async () => {
  const { fake, module, shown } = setup()
  const result = module.moveDishes(['a', 'c', 'd'], { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })!
  expect(shown()).toMatchObject({ ideen: ['b'], woche: [] })
  await result.settled

  const undone = await result.undo!()

  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'] })
  expect(undone).toMatchObject({ focus: { dish: 'a' } })
  expect(await undone.settled).not.toHaveProperty('notice')
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'] })
  expect(fake.sent).toEqual(['moveDishes a,c,d f-ideen', 'placeDishes a:ideen:0,c:ideen:2,d:woche:0'])
})

test('an undo of a move of several that fails puts them where the move had put them, with a notice', async () => {
  const { fake, module, shown } = setup()
  const result = module.moveDishes(['a', 'c'], { columnId: 'woche' })!
  await result.settled
  fake.failNext('placeDishes', 500)

  const undone = await result.undo!()
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'] })

  expect(await undone.settled).toMatchObject({ notice: 'returnManyFailed' })
  expect(shown()).toMatchObject({ ideen: ['b'], woche: ['a', 'c', 'd'] })
})

test('a move of several waits for a write of one of them still under way', async () => {
  const { fake, module, shown } = setup()
  const moving = fake.holdNext('moveDish')
  module.moveDish('b', { columnId: 'woche' })

  const result = module.moveDishes(['a', 'b'], { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })!
  await Promise.resolve()
  expect(fake.sent).toEqual(['moveDish b woche'])

  moving.succeed()
  await result.settled
  expect(fake.sent).toEqual(['moveDish b woche', 'moveDishes a,b f-ideen'])
  expect(shown()).toMatchObject({ ideen: ['c'], woche: ['d'] })
})

test('Dishes deleted together go at once and come back together where they were', async () => {
  const { fake, module, shown } = setup()

  const result = module.deleteDishes(['c', 'a', 'd'])!

  expect(shown()).toMatchObject({ ideen: ['b'], woche: [] })
  expect(result).toMatchObject({ notice: 'deletedMany', dishes: [{ id: 'a' }, { id: 'c' }, { id: 'd' }], focus: { dish: 'b' } })
  expect(await result.settled).not.toHaveProperty('notice')

  const undone = await result.undo!()
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'] })
  expect(await undone.settled).not.toHaveProperty('notice')
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'] })
  expect(fake.sent).toEqual(['deleteDishes a,c,d', 'restoreDishes a,c,d'])
})

test('a delete of several that fails puts every Dish back, with a notice; an undo that fails takes them off again', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('deleteDishes', 500)

  expect(await module.deleteDishes(['a', 'b'])!.settled).toMatchObject({ notice: 'deleteManyFailed' })
  expect(shown().ideen).toEqual(['a', 'b', 'c'])

  const result = module.deleteDishes(['a', 'b'])!
  await result.settled
  fake.failNext('restoreDishes', 500)
  expect(await (await result.undo!()).settled).toMatchObject({ notice: 'restoreManyFailed' })
  expect(shown().ideen).toEqual(['c'])
})

test('the Dish count follows a move of several to another Board and a delete of several', async () => {
  const { module } = setup()

  await module.moveDishes(['a', 'b'], { boardId: 'feierabend', columnId: 'f-ideen', isGekocht: false })!.settled
  expect(module.dishCount.value).toBe(2)
  await module.deleteDishes(['c'])!.settled
  expect(module.dishCount.value).toBe(1)
})
