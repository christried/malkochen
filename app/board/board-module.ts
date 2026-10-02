import type { Ref } from 'vue'
// Relative imports, not `~~`: the module's tests run in plain Node (the
// "client" Vitest project), which knows no Nuxt aliases.
import type { BoardView } from '../../server/utils/boards'
import type { CookingView } from '../../server/utils/cookings'
import type { DishPlacement, DishView, MovedDish, PlacedDish } from '../../server/utils/dishes'
import { dishOnBoard } from '../../shared/board'
import { landingIndex, recordsCooking } from '../../shared/placement'

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
// section (each takes the Dish's title, except `cook`: the Gekocht toast).
export type Notice = 'deleted' | 'deleteFailed' | 'restoreFailed' | 'moveFailed' | 'cookFailed' | 'uncookFailed' | 'cook'

// What an operation answers: the Dish it was about, where it now is, the
// Cooking it recorded, a notice to show, an undo to offer with it, where
// focus goes, and, for a write that may still fail after the Board changed,
// what it ended in once settled.
export interface BoardResult {
  dish: DishView
  placement?: DishPlacement
  cooking?: CookingView
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
  moveDish: (dishId: string, to: { columnId: string, index?: number }) => Promise<MovedDish>
  cookDish: (dishId: string) => Promise<MovedDish>
  undoCooking: (cookingId: string, to: { columnId: string, index: number }) => Promise<PlacedDish>
}

type BoardColumn = BoardView['columns'][number]

// Takes `item` out of `list`, if it is in it.
function removeFrom<T>(list: T[], item: T | undefined) {
  const at = item === undefined ? -1 : list.indexOf(item)
  if (at !== -1) list.splice(at, 1)
}

export function createBoardModule(board: Ref<BoardView | undefined>, transport: BoardTransport) {
  // Each Dish's writes, in the order they were made: one starts once the
  // one before it has settled, so they never cross on the way. With none
  // before it, it starts at once. A write is told whether it is still the
  // Dish's latest (`latest`): if not, a later one has changed the Dish on
  // the Board since, and settles it in turn.
  const queues = new Map<string, Promise<unknown>>()
  function queued<T>(dishId: string, write: (latest: () => boolean) => Promise<T>): Promise<T> {
    const before = queues.get(dishId)
    const run = () => write(() => queues.get(dishId) === tail)
    // A write that throws rather than rejecting fails like one that rejects.
    const next = before ? before.then(run, run) : new Promise<T>(resolve => resolve(run()))
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

  // Where a Dish is now, to put it back there later (putBack).
  function placeOf(column: BoardColumn, index: number) {
    return { columnId: column.id, index, above: column.dishes[index - 1]?.id, below: column.dishes[index + 1]?.id }
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
  function settle(dish: DishView, { placement, cooking: _, ...fields }: MovedDish) {
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

  // Moving a Dish (PRD stories 31–34): to `index` among a Column's other
  // Dishes (dragged), or without one to the top of another Column
  // (shared/placement.ts). It goes there at once, then where the server put
  // it. If the move fails, it goes back exactly where it was, with a notice;
  // one the server no longer has (another Member deleted it) just goes.
  //
  // Into the Gekocht Column it records a Cooking (stories 49–55): it shows
  // in the Dish's Cooking History at once, and the Gekocht toast (`cook`)
  // offers "Rückgängig". Null if it wouldn't move or record one.
  function moveDish(dishId: string, to: { columnId: string, index?: number }): BoardResult | null {
    return place(dishId, to, () => transport.moveDish(dishId, to))
  }

  // "Gekocht ✓" (PRD story 35): to the top of the Gekocht Column, or where
  // it is if it is there already, recording a Cooking either way.
  function cookDish(dishId: string): BoardResult | null {
    const gekocht = board.value?.columns.find(c => c.isGekocht)
    return gekocht ? place(dishId, { columnId: gekocht.id }, () => transport.cookDish(dishId), { cook: true }) : null
  }

  // Moves a Dish as moveDish says, sending `write` for it.
  function place(dishId: string, to: { columnId: string, index?: number }, write: () => Promise<MovedDish>, { cook = false } = {}): BoardResult | null {
    const found = find(dishId)
    const target = column(to.columnId)
    if (!found || !target || !board.value) return null
    const { dish, column: from } = found
    const index = from.dishes.indexOf(dish)
    const landing = landingIndex(target, dishId, to.index)
    const stays = target === from && landing === index
    const cooks = recordsCooking(from, target, { cook })
    if (stays && !cooks) return null
    const place = placeOf(from, index)
    const focus = stays ? { dish: dishId } : focusAfterLeaving(from, index)
    from.dishes.splice(index, 1)
    insert(target, landing, dish)
    const placement = { boardId: board.value.id, columnId: target.id, index: landing }
    // The Cooking as the server will record it, filled in once it has. The
    // Board's own (reactive) copy, so filling it in shows.
    if (cooks) dish.cookings.unshift({ id: '', cookedAt: new Date().toISOString(), note: null, recordedBy: null })
    const pending = cooks ? dish.cookings[0]! : undefined
    // How the move ended, for undo: failed, or with the Cooking it recorded.
    let failed = false
    let recorded: CookingView | undefined
    let undone = false

    const settled = queued(dishId, async (latest): Promise<BoardResult> => {
      try {
        const moved = await write()
        recorded = moved.cooking
        if (latest()) settle(dish, moved)
        // A later write has the Dish elsewhere by now: only the Cooking
        // settles, if it still shows, or goes if none was recorded.
        else if (pending && moved.cooking) Object.assign(pending, moved.cooking)
        else removeFrom(dish.cookings, pending)
        const cooking = moved.cooking && dish.cookings.find(c => c.id === moved.cooking!.id)
        return { dish, placement: moved.placement, ...cooking && { cooking } }
      }
      catch (error) {
        failed = true
        if (error instanceof WriteFailed && error.status === 404) {
          takeOut(dishId)
          return { dish }
        }
        // Undone already, it is back where it was.
        if (undone) return { dish }
        takeOut(dishId)
        removeFrom(dish.cookings, pending)
        putBack(dish, place.columnId, place)
        return { dish, notice: cooks ? 'cookFailed' : 'moveFailed' }
      }
    })

    // "Rückgängig" in the Gekocht toast (PRD story 51): the Dish is back
    // where it was at once, without that Cooking, with focus on it. Its
    // write waits for the move, then takes the Cooking off again (with none
    // recorded, it moves the Dish back). If that fails, the Dish is cooked
    // again where it was, with a notice. After a failed move, the Dish is
    // back already.
    async function undo(): Promise<BoardResult> {
      if (failed) return { dish }
      undone = true
      const now = find(dishId)
      const cookedPlace = now && placeOf(now.column, now.column.dishes.indexOf(now.dish))
      takeOut(dishId)
      putBack(dish, place.columnId, place)
      removeFrom(dish.cookings, dish.cookings.find(c => c === pending || c.id === recorded?.id))

      const back = { columnId: place.columnId, index: place.index }
      const undoing = queued(dishId, async (latest): Promise<BoardResult> => {
        if (failed) return { dish }
        try {
          const placed = recorded ? await transport.undoCooking(recorded.id, back) : await transport.moveDish(dishId, back)
          if (latest()) settle(dish, placed)
          return { dish, placement: placed.placement }
        }
        catch (error) {
          // Its Cooking stays gone if it is gone on the server (deleted
          // from the Cooking History meanwhile).
          const gone = error instanceof WriteFailed && error.status === 404
          if (recorded && !gone && !dish.cookings.some(c => c.id === recorded!.id)) dish.cookings.unshift(recorded)
          if (cookedPlace) {
            takeOut(dishId)
            putBack(dish, cookedPlace.columnId, cookedPlace)
          }
          return { dish, notice: 'uncookFailed' }
        }
      })
      return { dish, focus: { dish: dishId }, settled: undoing }
    }

    return { dish, placement, focus, settled, ...pending && { cooking: pending, notice: 'cook', undo } }
  }

  return { deleteDish, moveDish, cookDish }
}
