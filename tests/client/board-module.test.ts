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
  expect(await result.undo!()).not.toHaveProperty('notice')
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(fake.sent).toEqual(['deleteDish b', 'restoreDish b'])
})

test('undo pressed while the delete is still under way waits for it, then restores', async () => {
  const { fake, module, shown } = setup()
  const deleting = fake.holdNext('deleteDish')
  const result = module.deleteDish('b')!

  const undone = result.undo!()
  await Promise.resolve()
  expect(fake.sent).toEqual(['deleteDish b'])
  expect(shown().ideen).toEqual(['a', 'c'])

  deleting.succeed()
  expect(await undone).toMatchObject({ focus: { dish: 'b' } })
  expect(fake.sent).toEqual(['deleteDish b', 'restoreDish b'])
  expect(shown().ideen).toEqual(['a', 'b', 'c'])
  expect(fake.server.columns[0]!.dishes.map(d => d.id)).toEqual(['a', 'b', 'c'])
})

test('an undo that fails takes the Dish off the Board again, with a notice', async () => {
  const { fake, module, shown } = setup()
  const result = module.deleteDish('b')!
  await result.settled
  fake.failNext('restoreDish', 500)

  expect(await result.undo!()).toMatchObject({ notice: 'restoreFailed' })
  expect(shown().ideen).toEqual(['a', 'c'])
})

test('undo after another Member deleted the Dish’s Column puts it where the server restored it', async () => {
  const { board, fake, module, shown } = setup()
  const result = module.deleteDish('d')!
  await result.settled
  // Another Member deletes Diese Woche; the next poll takes it off the Board.
  fake.deleteColumnElsewhere('woche')
  board.value!.columns.splice(1, 1)

  expect(await result.undo!()).toMatchObject({ focus: { dish: 'd' } })
  expect(shown()).toEqual({ ideen: ['d', 'a', 'b', 'c'], gekocht: [] })
})

test('after a delete, focus goes to the Dish now in its place, else the one above, else its Column', () => {
  const { module } = setup()

  expect(module.deleteDish('b')).toMatchObject({ focus: { dish: 'c' } })
  expect(module.deleteDish('c')).toMatchObject({ focus: { dish: 'a' } })
  expect(module.deleteDish('d')).toMatchObject({ focus: { column: 'woche' } })
})
