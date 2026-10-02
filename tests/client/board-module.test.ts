import { expect, test } from 'vitest'
import { ref } from 'vue'
import { createBoardModule } from '../../app/board/board-module'
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import { memoryTransport } from './memory-transport'

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

function setup() {
  const board = ref<BoardView | undefined>(boardFixture())
  const fake = memoryTransport(boardFixture())
  const module = createBoardModule(board, fake.transport)
  // Each Column's Dish ids, as the Board shows them.
  const shown = () => Object.fromEntries(board.value!.columns.map(c => [c.id, c.dishes.map(d => d.id)]))
  return { board, fake, module, shown }
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

test('undo after another Member deleted the Dish’s Column puts it where the server restored it', async () => {
  const { board, fake, module, shown } = setup()
  const result = module.deleteDish('d')!
  await result.settled
  // Another Member deletes Diese Woche; the next poll takes it off the Board.
  fake.deleteColumnElsewhere('woche')
  board.value!.columns.splice(1, 1)

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

test('a move into Gekocht records a Cooking at once, filled in once settled; a move within Gekocht records none', async () => {
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

test('"Gekocht ✓" on a Dish already in Gekocht records another Cooking and leaves it where it is', async () => {
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
