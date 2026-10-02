import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule } from '../../app/board/board-module'
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import { memoryTransport, type MemoryTransport } from './memory-transport'

// Seam 4: the client Board module, through its operations. The Board goes
// in, operations run against the in-memory transport (a fake server), and
// the tests look at the Board and at what each operation answers.

function dish(id: string): DishView {
  return { id, title: `Titel ${id}`, note: null, source: null, imageUrl: null, placeholder: 'curry', addedBy: null, createdAt: '2026-10-01T12:00:00.000Z', cookings: [] }
}

// A Board with Ideen (a, b, c), Diese Woche (d) and Gekocht (empty).
function boardFixture(): BoardView {
  return {
    id: 'board',
    name: 'Kochclub',
    emoji: '🍜',
    isOwner: true,
    inviteToken: 'token',
    members: [],
    newDishIds: [],
    columns: [
      { id: 'ideen', name: 'Ideen', isGekocht: false, dishes: [dish('a'), dish('b'), dish('c')] },
      { id: 'woche', name: 'Diese Woche', isGekocht: false, dishes: [dish('d')] },
      { id: 'gekocht', name: 'Gekocht', isGekocht: true, dishes: [] },
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
      { id: 'f-ideen', name: 'Ideen', isGekocht: false, dishes: [dish('e')] },
      { id: 'f-gekocht', name: 'Gekocht', isGekocht: true, dishes: [] },
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

// A poll of the Board, for the module's sync: the server answers at once
// with the Board as it has it.
function poll(fake: MemoryTransport) {
  return () => Promise.resolve(structuredClone(fake.server))
}

// A poll the server reads the Board for when asked, but answers only when
// the test says so.
function slowPoll(fake: MemoryTransport) {
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
  await module.sync(poll(fake))
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
  module.moveToBoard('c', { boardId: 'feierabend', columnId: 'f-ideen' })
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
  expect(into).toMatchObject({ notice: 'cook', cooking: { note: null } })
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
    { id: 'sept-20', cookedAt: '2020-09-20T18:00:00.000Z', note: 'mit Feta', recordedBy: null },
    { id: 'sept-1', cookedAt: '2020-09-01T18:00:00.000Z', note: null, recordedBy: null },
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

  const result = await module.addDish('board', { title: 'Shakshuka', placeholder: 'curry' })

  expect(result.placement).toEqual({ boardId: 'board', columnId: 'woche', index: 0 })
  expect(result.dish.title).toBe('Shakshuka')
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

test('an edit replaces the Dish’s fields with what the server saved', async () => {
  const { board, module, shown } = setup()
  const shownDish = () => board.value!.columns[0]!.dishes[1]!

  const result = await module.editDish('b', { title: '  Ofengemüse ', note: 'mit Feta', source: { link: 'https://www.tiktok.com/@koch/video/1', kind: 'tiktok' } })

  expect(result).not.toHaveProperty('notice')
  expect(shownDish()).toMatchObject({ id: 'b', title: 'Ofengemüse', note: 'mit Feta', source: { link: 'https://www.tiktok.com/@koch/video/1', kind: 'tiktok' } })
  expect(result.dish).toBe(shownDish())
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
})

test('an edit whose new image couldn’t be stored keeps the image it had, and says so', async () => {
  const { board, module } = setup(fixture => (fixture.columns[0]!.dishes[1]!.imageUrl = '/images/b.jpg'))

  const result = await module.editDish('b', { title: 'Neu', imageUrl: 'https://cdn.example/neu.jpg' })

  expect(result).toMatchObject({ notice: 'imageNotReplaced', dish: { title: 'Neu', imageUrl: '/images/b.jpg' } })
  expect(board.value!.columns[0]!.dishes[1]!.imageUrl).toBe('/images/b.jpg')
})

test('a saved Cooking note shows in the Dish’s Cooking History as the server saved it; a blank one removes it', async () => {
  const { board, module } = setup(cookedTwice)
  const cookingsOf = () => board.value!.columns[1]!.dishes[0]!.cookings

  const result = await module.noteCooking('d', 'sept-1', '  mit Reis ')
  expect(result).toMatchObject({ cooking: { id: 'sept-1', note: 'mit Reis' } })
  expect(cookingsOf()).toMatchObject([{ id: 'sept-20', note: 'mit Feta' }, { id: 'sept-1', note: 'mit Reis' }])

  await module.noteCooking('d', 'sept-20', '   ')
  expect(cookingsOf()).toMatchObject([{ id: 'sept-20', note: null }, { id: 'sept-1', note: 'mit Reis' }])
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

  const result = module.moveToBoard('b', { boardId: 'feierabend', columnId: 'f-ideen' })!

  expect(shown().ideen).toEqual(['a', 'c'])
  expect(result).toMatchObject({ dish: { id: 'b' }, placement: { boardId: 'feierabend', columnId: 'f-ideen', index: 0 }, focus: { dish: 'c' } })
  expect(await result.settled).toEqual({ dish: result.dish, placement: { boardId: 'feierabend', columnId: 'f-ideen', index: 0 } })
  expect(shown().ideen).toEqual(['a', 'c'])
  expect(fake.sent).toEqual(['moveDish b f-ideen'])
})

test('a move to another Board that fails puts the Dish back exactly where it was, with a notice', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('moveDish', 500)

  const result = module.moveToBoard('b', { boardId: 'feierabend', columnId: 'f-ideen' })!
  // Deleting Dish a meanwhile moves c up to b's old index: b still goes back above c.
  module.deleteDish('a')

  expect(await result.settled).toEqual({ dish: result.dish, notice: 'moveFailed' })
  expect(shown().ideen).toEqual(['b', 'c'])
})

test('a Dish another Member deleted already (404) stays gone when moved to another Board, without a notice', async () => {
  const { fake, module, shown } = setup()
  fake.deleteDishElsewhere('b')

  const result = module.moveToBoard('b', { boardId: 'feierabend', columnId: 'f-ideen' })!

  expect(await result.settled).toEqual({ dish: result.dish })
  expect(shown().ideen).toEqual(['a', 'c'])
})

test('a move then a move to another Board that both fail leave the Dish where it was before either', async () => {
  const { fake, module, shown } = setup()
  fake.failNext('moveDish', 500)
  fake.failNext('moveDish', 500)

  const moved = module.moveDish('b', { columnId: 'woche' })!
  const movedAway = module.moveToBoard('b', { boardId: 'feierabend', columnId: 'f-ideen' })!

  expect(await moved.settled).toMatchObject({ notice: 'moveFailed' })
  expect(await movedAway.settled).toMatchObject({ notice: 'moveFailed' })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], woche: ['d'] })
  expect(fake.sent).toEqual(['moveDish b woche', 'moveDish b f-ideen'])
})

test('a Dish moved into another Board’s Gekocht Column keeps its Cooking History here, with no Gekocht toast or undo', async () => {
  const { module, shown } = setup(cookedTwice)

  const result = module.moveToBoard('d', { boardId: 'feierabend', columnId: 'f-gekocht' })!

  expect(result).not.toHaveProperty('notice')
  expect(result).not.toHaveProperty('undo')
  expect(result).not.toHaveProperty('cooking')
  expect(await result.settled).toEqual({ dish: result.dish, placement: { boardId: 'feierabend', columnId: 'f-gekocht', index: 0 } })
  expect(result.dish.cookings.map(c => c.id)).toEqual(['sept-20', 'sept-1'])
  expect(shown().woche).toEqual([])
})

test('a poll brings other Members’ changes, keeping the Columns and Dishes still there as they were', async () => {
  const { board, fake, module, shown } = setup()
  const ideen = board.value!.columns[0]!
  const a = ideen.dishes[0]!
  fake.server.columns[0]!.dishes.unshift(dish('z'))
  fake.server.columns[0]!.dishes[1]!.title = 'Alans Auflauf'
  fake.deleteDishElsewhere('c')
  fake.server.newDishIds = ['z']

  await module.sync(poll(fake))

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

  await module.sync(poll(fake))
  expect(shown()).toMatchObject({ ideen: ['a', 'c'], woche: ['b', 'd'] })

  held.succeed()
  await result.settled
  expect(shown()).toMatchObject({ ideen: ['a', 'c'], woche: ['b', 'd'] })
})

test('a poll asked before a write and answered after it settled is dropped, as the server read the Board before the write', async () => {
  const { fake, module, shown } = setup()
  const slow = slowPoll(fake)
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
  await module.sync(poll(fake))

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

  await module.sync(poll(fake))
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], gekocht: [] })
  expect(history('a')).toEqual([])

  held.succeed()
  expect(await undone.settled).toMatchObject({ placement: { columnId: 'ideen', index: 0 } })
  expect(shown()).toMatchObject({ ideen: ['a', 'b', 'c'], gekocht: [] })
})

test('a poll answered while a Dish is being dragged is dropped', async () => {
  const { fake, module, shown } = setup()
  fake.deleteDishElsewhere('c')

  await module.sync(poll(fake), { paused: () => true })

  expect(shown().ideen).toEqual(['a', 'b', 'c'])
})
