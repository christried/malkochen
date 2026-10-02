import type { Ref } from 'vue'
// Relative imports, not `~~`: the module's tests run in plain Node (the
// "client" Vitest project), which knows no Nuxt aliases.
import type { BoardView } from '../../server/utils/boards'
import type { DishView, PlacedDish } from '../../server/utils/dishes'
import { dishOnBoard } from '../../shared/board'

// The client Board module (spec #61): owns the app's copy of an open Board.
// Every change to it goes through an operation here, which changes the
// Board at once where that is optimistic, sends the write through the
// transport, then settles to where the server says the Dish is, or rolls
// back. Operations show no UI: they answer a plain result (BoardResult) that
// the page turns into Toasts, haptics and focus. Plain Vue reactivity, no
// Nuxt and no DOM, so it runs in Node under test.

// Where focus goes after an operation: a Dish's card, or a Column.
export type FocusTarget = { dish: string } | { column: string }

// Where focus goes when the Dish at `index` leaves its Column: the Dish
// that takes its place (the one below, else the one above), or the Column
// itself if it is left empty.
export function focusAfterLeaving(column: { id: string, dishes: { id: string }[] }, index: number): FocusTarget {
  const next = column.dishes[index + 1] ?? column.dishes[index - 1]
  return next ? { dish: next.id } : { column: column.id }
}

// What the page tells the Member, as a key into the UI strings' `dish`
// section (each takes the Dish's title).
export type Notice = 'deleted' | 'deleteFailed' | 'restoreFailed'

// What an operation answers: the Dish it was about, a notice to show, an
// undo to offer with it, where focus goes, and, for a write that may still
// fail after the Board changed, what it ended in once settled.
export interface BoardResult {
  dish: DishView
  notice?: Notice
  undo?: () => Promise<BoardResult>
  focus?: FocusTarget
  settled?: Promise<BoardResult>
}

// A write the server refused or never answered; `status` is its HTTP status
// if there was one (404: the Dish is gone there).
export class WriteFailed extends Error {
  constructor(readonly status?: number) {
    super(status === undefined ? 'Write failed' : `Write failed (${status})`)
  }
}

// How the module's writes reach the server: over HTTP in the app
// (http-transport.ts), in memory under test. A failed write rejects with
// WriteFailed.
export interface BoardTransport {
  deleteDish: (dishId: string) => Promise<void>
  restoreDish: (dishId: string) => Promise<PlacedDish>
}

type BoardColumn = BoardView['columns'][number]

export function createBoardModule(board: Ref<BoardView | undefined>, transport: BoardTransport) {
  // Each Dish's writes, in the order they were made: one starts once the
  // one before it has settled, so they never cross on the way. With none
  // before it, it starts at once.
  const queues = new Map<string, Promise<unknown>>()
  function queued<T>(dishId: string, write: () => Promise<T>): Promise<T> {
    const before = queues.get(dishId)
    // A write that throws rather than rejecting fails like one that rejects.
    const next = before ? before.then(write, write) : new Promise<T>(resolve => resolve(write()))
    const tail: Promise<unknown> = next.catch(() => {}).then(() => queues.get(dishId) === tail && queues.delete(dishId))
    queues.set(dishId, tail)
    return next
  }

  function find(dishId: string) {
    return board.value ? dishOnBoard(board.value, dishId) : null
  }

  function column(columnId: string) {
    return board.value?.columns.find(c => c.id === columnId)
  }

  function insert(into: BoardColumn, index: number, dish: DishView) {
    into.dishes.splice(Math.min(index, into.dishes.length), 0, dish)
  }

  // Puts a Dish back into its Column between the neighbours it had, found
  // by id, whatever changed meanwhile; else at its old index. Answers
  // whether it did: not if the Column is gone, or the Dish is back already.
  function putBack(dish: DishView, columnId: string, place: { index: number, above?: string, below?: string }): boolean {
    const into = column(columnId)
    if (!into || find(dish.id)) return false
    const belowAt = into.dishes.findIndex(d => d.id === place.below)
    const aboveAt = into.dishes.findIndex(d => d.id === place.above)
    insert(into, belowAt !== -1 ? belowAt : aboveAt !== -1 ? aboveAt + 1 : place.index, dish)
    return true
  }

  // Takes a Dish off the Board, wherever it is now.
  function takeOut(dishId: string) {
    const found = find(dishId)
    found?.column.dishes.splice(found.column.dishes.indexOf(found.dish), 1)
  }

  // Settles a Dish to where the server says it is: its fields as the server
  // has them, at its index in its Column, both found by id now. A Column
  // the Board doesn't show yet (another Member just added it) leaves the
  // Dish where it is until the next poll brings that Column.
  function settle(dish: DishView, { placement, ...fields }: PlacedDish) {
    Object.assign(dish, fields)
    const into = column(placement.columnId)
    if (!into) return
    takeOut(dish.id)
    insert(into, placement.index, dish)
  }

  // Deleting a Dish (PRD story 47): its card goes at once. If the delete
  // fails, it comes back with a notice; one the server no longer has
  // (another Member deleted it) counts as deleted.
  function deleteDish(dishId: string): BoardResult | null {
    const found = find(dishId)
    if (!found) return null
    const { dish, column: from } = found
    const index = from.dishes.indexOf(dish)
    const place = { index, above: from.dishes[index - 1]?.id, below: from.dishes[index + 1]?.id }
    const focus = focusAfterLeaving(from, index)
    from.dishes.splice(index, 1)

    const deleted = queued(dishId, () => transport.deleteDish(dishId)).then(() => true, (error: unknown) => {
      if (error instanceof WriteFailed && error.status === 404) return true
      putBack(dish, from.id, place)
      return false
    })
    const settled = deleted.then((ok): BoardResult => ok ? { dish } : { dish, notice: 'deleteFailed' })

    // "Rückgängig": once the delete has settled, the Dish is back at once,
    // with focus on it, and then where the server restored it. If that
    // fails, it goes again, with a notice.
    async function undo(): Promise<BoardResult> {
      if (!await deleted) return { dish } // Never deleted, and back already.
      const back = putBack(dish, from.id, place)
      const restored = queued(dishId, () => transport.restoreDish(dishId)).then((placed): BoardResult => {
        settle(dish, placed)
        // Its Column was gone, so only now is it back to focus.
        return back ? { dish } : { dish, focus: { dish: dishId } }
      }, (): BoardResult => {
        takeOut(dishId)
        return { dish, notice: 'restoreFailed' }
      })
      return { dish, ...back && { focus: { dish: dishId } }, settled: restored }
    }

    return { dish, notice: 'deleted', undo, focus, settled }
  }

  return { deleteDish }
}
