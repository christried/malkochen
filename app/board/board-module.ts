import type { Ref } from 'vue'
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

export function createBoardModule(board: Ref<BoardView | undefined>, transport: BoardTransport) {
  // Each Dish's writes, in the order they were made: one starts once the
  // one before it has settled, so they never cross on the way. With none
  // before it, it starts at once.
  const queues = new Map<string, Promise<unknown>>()
  function queued<T>(dishId: string, write: () => Promise<T>): Promise<T> {
    const before = queues.get(dishId)
    const next = before ? before.then(write, write) : write()
    const settled: Promise<unknown> = next.catch(() => {}).then(() => queues.get(dishId) === settled && queues.delete(dishId))
    queues.set(dishId, settled)
    return next
  }

  function column(columnId: string) {
    return board.value?.columns.find(c => c.id === columnId)
  }

  // Puts a Dish back into its Column between the neighbours it had, found
  // by id, whatever changed meanwhile; else at its old index.
  function putBack(dish: DishView, columnId: string, place: { index: number, above?: string, below?: string }) {
    const into = column(columnId)
    if (!into || board.value && dishOnBoard(board.value, dish.id)) return
    const belowAt = into.dishes.findIndex(d => d.id === place.below)
    const aboveAt = into.dishes.findIndex(d => d.id === place.above)
    const at = belowAt !== -1 ? belowAt : aboveAt !== -1 ? aboveAt + 1 : Math.min(place.index, into.dishes.length)
    into.dishes.splice(at, 0, dish)
  }

  // Takes a Dish off the Board, wherever it is now.
  function takeOut(dishId: string) {
    const found = board.value && dishOnBoard(board.value, dishId)
    found?.column.dishes.splice(found.column.dishes.indexOf(found.dish), 1)
  }

  // Settles a Dish to where the server says it is: its fields as the server
  // has them, at its index in its Column, both found by id now. A Dish the
  // server put on another Board leaves this one.
  function settle(dish: DishView, { placement, ...fields }: PlacedDish) {
    takeOut(dish.id)
    Object.assign(dish, fields)
    const into = placement.boardId === board.value?.id ? column(placement.columnId) : undefined
    into?.dishes.splice(Math.min(placement.index, into.dishes.length), 0, dish)
  }

  // Deleting a Dish (PRD story 47): its card goes at once. If the delete
  // fails, it comes back with a notice; one the server no longer has
  // (another Member deleted it) counts as deleted.
  function deleteDish(dishId: string): BoardResult | null {
    const found = board.value && dishOnBoard(board.value, dishId)
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
    // then where the server restored it. If that fails, it goes again.
    async function undo(): Promise<BoardResult> {
      if (!await deleted) return { dish } // Never deleted, and back already.
      putBack(dish, from.id, place)
      try {
        settle(dish, await queued(dishId, () => transport.restoreDish(dishId)))
        return { dish, focus: { dish: dishId } }
      }
      catch {
        takeOut(dishId)
        return { dish, notice: 'restoreFailed' }
      }
    }

    return { dish, notice: 'deleted', undo, focus, settled }
  }

  return { deleteDish }
}
